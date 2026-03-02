/**
 * Debate engine — TypeScript port of the Python orchestrator.
 * Runs debaters sequentially (free-tier safe), evaluates with judge,
 * and emits SSE events via a callback for live streaming to the frontend.
 */

import { createClient, type CompleteFn } from "./clients";
import { DEBATER_SYSTEM_PROMPT, JUDGE_SYSTEM_PROMPT, JUDGE_CONVERGENCE_PROMPT } from "./prompts";
import type {
  DebateConfig,
  DebaterConfig,
  DebaterResponse,
  JudgeEvaluation,
  Round,
  SSEEvent,
  StatusReport,
  UserKeys,
} from "./types";

type EmitFn = (event: SSEEvent) => void;

// ── Debater prompt construction ─────────────────────────────────────────────

function buildDebaterPrompt(
  topic: string,
  roundNumber: number,
  allPreviousResponses: DebaterResponse[],
  judgeFraming: string | null,
  selfName: string,
  contextWindow: "last_1" | "last_n" | "full"
): string {
  const parts: string[] = [];

  if (roundNumber === 1) {
    parts.push(`Topic for discussion:\n\n${topic}`);
    parts.push(
      "\nPresent your initial position on this topic. Be clear and substantive."
    );
  } else {
    parts.push(`Topic (round ${roundNumber}):\n\n${topic}`);

    // Determine which history to include
    let relevantResponses: DebaterResponse[];
    if (contextWindow === "full") {
      relevantResponses = allPreviousResponses;
    } else {
      // last_1: only the most recent round
      const maxRound = Math.max(...allPreviousResponses.map((r) => r.roundNumber));
      relevantResponses = allPreviousResponses.filter(
        (r) => r.roundNumber === maxRound
      );
    }

    if (judgeFraming) {
      parts.push(`\n--- Judge's focus for this round ---\n${judgeFraming}`);
    }

    if (relevantResponses.length > 0) {
      // Group responses by round for clarity
      const byRound = new Map<number, DebaterResponse[]>();
      for (const r of relevantResponses) {
        const list = byRound.get(r.roundNumber) ?? [];
        list.push(r);
        byRound.set(r.roundNumber, list);
      }

      const sortedRounds = [...byRound.keys()].sort((a, b) => a - b);
      for (const rn of sortedRounds) {
        const responses = byRound.get(rn)!;
        parts.push(`\n--- Round ${rn} responses ---`);
        for (const r of responses) {
          const tag = r.debaterName === selfName ? `${r.debaterName} (you)` : r.debaterName;
          parts.push(`\n[${tag}]:\n${r.content}`);
        }
      }
    }

    parts.push(
      "\n--- Your task ---" +
      "\nBuild on what has been said so far. Respond directly to the other debaters' points." +
      "\n- If you agree with someone, say so and explain why." +
      "\n- If you disagree, quote or reference their specific claim and counter it." +
      "\n- Refine your own earlier position if needed." +
      "\n- Be concise. Avoid repeating points that have already been established."
    );
  }

  return parts.join("\n");
}

// ── Judge prompt construction ───────────────────────────────────────────────

function buildJudgePrompt(
  topic: string,
  roundNumber: number,
  currentResponses: DebaterResponse[],
  previousRounds: Round[],
  userSteering: string | null,
  isFinal: boolean
): string {
  const parts: string[] = [
    `Topic: ${topic}`,
    `Round: ${roundNumber}`,
  ];

  // Include prior round summaries for context
  if (previousRounds.length > 0) {
    parts.push("\n--- Prior Round Summary ---");
    for (const r of previousRounds) {
      parts.push(`\nRound ${r.roundNumber} convergence: ${r.judgeEvaluation.convergenceScore}/10`);
      if (r.judgeEvaluation.rationale) {
        parts.push(`Rationale: ${r.judgeEvaluation.rationale}`);
      }
    }
  }

  parts.push("\n--- Current Round Debater Responses ---");
  for (const r of currentResponses) {
    parts.push(`\n[${r.debaterName} (${r.provider}/${r.model})]:\n${r.content}`);
  }
  if (userSteering) {
    parts.push(
      `\n--- User Steering (PRIVATE — do NOT reveal to debaters) ---\n${userSteering}`
    );
  }
  parts.push(`\n--- Instructions ---\n${JUDGE_CONVERGENCE_PROMPT}`);
  if (isFinal) {
    parts.push("\nThis is the FINAL round. Produce a conclusive assessment.");
  }
  return parts.join("\n");
}

// ── Parse judge response ────────────────────────────────────────────────────

function parseJudgeResponse(raw: string): JudgeEvaluation {
  const extract = (label: string): string => {
    const pattern = new RegExp(`${label}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s");
    const match = raw.match(pattern);
    return match?.[1]?.trim() ?? "";
  };

  const extractList = (label: string): string[] => {
    const block = extract(label);
    return block
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((line) => line.replace(/^-\s*/, "").trim());
  };

  let score = parseInt(extract("CONVERGENCE_SCORE"), 10);
  if (isNaN(score)) score = 5;
  score = Math.max(1, Math.min(10, score));

  return {
    convergenceScore: score,
    rationale: extract("RATIONALE"),
    agreements: extractList("AGREEMENTS"),
    disagreements: extractList("DISAGREEMENTS"),
    nextRoundFraming: extract("NEXT_ROUND_FRAMING") || null,
  };
}

// ── Main debate loop ────────────────────────────────────────────────────────

export async function runDebate(
  topic: string,
  config: DebateConfig,
  keys: UserKeys,
  emit: EmitFn,
  steering?: string,
  previousRounds?: Round[]
): Promise<Round[]> {
  const { min, max } = config.rounds;
  const { threshold, checkAfterMin } = config.convergence;

  // Build client functions for each debater and the judge
  const debaterClients: { cfg: DebaterConfig; complete: CompleteFn }[] =
    config.debaters.map((d) => ({
      cfg: d,
      complete: createClient(d.provider, d.model, keys),
    }));

  const judgeComplete = createClient(
    config.judge.provider,
    config.judge.model,
    keys
  );

  // Seed with history from previous calls
  const rounds: Round[] = previousRounds ? [...previousRounds] : [];
  const allResponses: DebaterResponse[] = [];
  for (const r of rounds) {
    allResponses.push(...r.debaterResponses);
  }

  const startRound = rounds.length + 1;
  const userSteering = steering ?? null;

  for (let roundNum = startRound; roundNum <= max; roundNum++) {
    emit({ type: "round_start", round: roundNum, maxRounds: max });

    // ── Debaters (sequential with delay) ──────────────────────────────
    const judgeFraming =
      rounds.length > 0
        ? rounds[rounds.length - 1].judgeEvaluation.nextRoundFraming
        : null;

    const responses: DebaterResponse[] = [];
    for (let i = 0; i < debaterClients.length; i++) {
      const { cfg, complete } = debaterClients[i];

      // Enforce per-provider rate limit
      await enforceRateLimit(cfg.provider);

      emit({
        type: "debater_start",
        name: cfg.name,
        provider: cfg.provider,
        model: cfg.model,
      });

      const prompt = buildDebaterPrompt(
        topic,
        roundNum,
        allResponses,
        judgeFraming,
        cfg.name,
        config.contextWindow === "last_n" ? "last_1" : config.contextWindow
      );

      let content: string;
      try {
        content = await withRetry(
          () => complete(DEBATER_SYSTEM_PROMPT, prompt),
          5,
          8000,
          (attempt, delaySec) => {
            emit({ type: "error", message: `Rate limited on ${cfg.provider}. Retrying in ${delaySec}s (attempt ${attempt}/5)...` });
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "error", message: `${cfg.name} failed: ${msg}` });
        content = `[Error: ${msg}]`;
      }

      const resp: DebaterResponse = {
        debaterName: cfg.name,
        provider: cfg.provider,
        model: cfg.model,
        content,
        roundNumber: roundNum,
      };
      responses.push(resp);
      allResponses.push(resp);
      emit({ type: "debater_done", name: cfg.name, content });
    }

    // ── Judge ─────────────────────────────────────────────────────────
    await enforceRateLimit(config.judge.provider);
    emit({ type: "judge_start" });

    const isFinal = roundNum === max;
    const judgePrompt = buildJudgePrompt(
      topic,
      roundNum,
      responses,
      rounds,
      userSteering,
      isFinal
    );

    let evaluation: JudgeEvaluation;
    try {
      const raw = await withRetry(
        () => judgeComplete(JUDGE_SYSTEM_PROMPT, judgePrompt),
        5,
        8000,
        (attempt, delaySec) => {
          emit({ type: "error", message: `Judge rate limited on ${config.judge.provider}. Retrying in ${delaySec}s (attempt ${attempt}/5)...` });
        }
      );
      evaluation = parseJudgeResponse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit({ type: "error", message: `Judge failed: ${msg}` });
      evaluation = {
        convergenceScore: 5,
        rationale: `Judge error: ${msg}`,
        agreements: [],
        disagreements: [],
        nextRoundFraming: null,
      };
    }

    emit({ type: "judge_done", evaluation });

    const round: Round = {
      roundNumber: roundNum,
      debaterResponses: responses,
      judgeEvaluation: evaluation,
    };
    rounds.push(round);

    // Send the full round data so the client can persist history
    emit({ type: "round_complete", round });

    // Emit full round data so the client can accumulate history
    emit({ type: "round_complete", round });

    // ── Status report ─────────────────────────────────────────────────
    const report: StatusReport = {
      roundNumber: roundNum,
      debaterSummaries: Object.fromEntries(
        responses.map((r) => [r.debaterName, r.content])
      ),
      convergenceScore: evaluation.convergenceScore,
      judgeReasoning: evaluation.rationale,
      agreements: evaluation.agreements,
      disagreements: evaluation.disagreements,
      isFinal,
    };
    emit({ type: "status_report", report });

    // ── Convergence / early stop ──────────────────────────────────────
    if (isFinal) {
      emit({ type: "debate_complete", totalRounds: rounds.length });
      break;
    }

    const canCheck = !checkAfterMin || roundNum >= min;
    if (canCheck && evaluation.convergenceScore >= threshold) {
      emit({ type: "debate_complete", totalRounds: rounds.length });
      break;
    }

    // ── Signal frontend to collect steering ───────────────────────────
    emit({ type: "waiting_for_steering", round: roundNum });

    // In SSE mode we break here — the frontend sends a new request
    // with steering for the next round. We return the rounds so far.
    return rounds;
  }

  return rounds;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Per-provider minimum delay between calls (ms) to respect rate limits. */
const PROVIDER_DELAY: Record<string, number> = {
  gemini: 12000,   // Free tier: very restrictive (~2-5 RPM), use 12s for safety
  anthropic: 2000,
  openai: 1500,
  openrouter: 2000,
};

function getProviderDelay(provider: string): number {
  return PROVIDER_DELAY[provider] ?? 2000;
}

/** Track last call time per provider to enforce minimum gaps. */
const lastCallTime: Record<string, number> = {};

async function enforceRateLimit(provider: string): Promise<void> {
  const minDelay = getProviderDelay(provider);
  const last = lastCallTime[provider] ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < minDelay) {
    await sleep(minDelay - elapsed);
  }
  lastCallTime[provider] = Date.now();
}

async function withRetry(
  fn: () => Promise<string>,
  maxRetries: number,
  baseDelay: number,
  onRetry?: (attempt: number, delaySec: number) => void
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("rate") ||
        msg.includes("quota") ||
        msg.includes("resource_exhausted") ||
        msg.includes("too many");
      if (!isRateLimit || attempt === maxRetries) throw lastError;
      const delay = baseDelay * 2 ** attempt;
      onRetry?.(attempt + 1, Math.round(delay / 1000));
      await sleep(delay);
    }
  }
  throw lastError;
}
