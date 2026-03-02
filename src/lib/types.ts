/** Pydantic-equivalent types for the debate pipeline. */

export interface DebaterConfig {
  name: string;
  provider: "openrouter" | "openai" | "anthropic" | "gemini";
  model: string;
}

export interface JudgeConfig {
  provider: "openrouter" | "openai" | "anthropic" | "gemini";
  model: string;
}

export interface DebateConfig {
  rounds: { min: number; max: number };
  convergence: { threshold: number; checkAfterMin: boolean };
  contextWindow: "last_1" | "last_n" | "full";
  debaters: DebaterConfig[];
  judge: JudgeConfig;
}

export interface DebaterResponse {
  debaterName: string;
  provider: string;
  model: string;
  content: string;
  roundNumber: number;
}

export interface JudgeEvaluation {
  convergenceScore: number;
  rationale: string;
  agreements: string[];
  disagreements: string[];
  nextRoundFraming: string | null;
}

export interface Round {
  roundNumber: number;
  debaterResponses: DebaterResponse[];
  judgeEvaluation: JudgeEvaluation;
}

export interface StatusReport {
  roundNumber: number;
  debaterSummaries: Record<string, string>;
  convergenceScore: number;
  judgeReasoning: string;
  agreements: string[];
  disagreements: string[];
  isFinal: boolean;
}

/** SSE event types sent to the frontend. */
export type SSEEvent =
  | { type: "round_start"; round: number; maxRounds: number }
  | { type: "debater_start"; name: string; provider: string; model: string }
  | { type: "debater_done"; name: string; content: string }
  | { type: "judge_start" }
  | { type: "judge_done"; evaluation: JudgeEvaluation }
  | { type: "round_complete"; round: Round }
  | { type: "status_report"; report: StatusReport }
  | { type: "debate_complete"; totalRounds: number }
  | { type: "debate_meta"; debateId: string }
  | { type: "error"; message: string }
  | { type: "waiting_for_steering"; round: number };

/** User API keys provided via BYOK. */
export interface UserKeys {
  openrouter?: string;
  openai?: string;
  anthropic?: string;
  gemini?: string;
}

/** Request body for the /api/debate endpoint. */
export interface DebateRequest {
  topic: string;
  config: DebateConfig;
  keys: UserKeys;
  steering?: string; // user steering for current round
  previousRounds?: Round[]; // accumulated history from prior calls
  debateId?: string; // existing debate ID (for continuation rounds)
}
