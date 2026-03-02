"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";import KeysModal from "@/components/KeysModal";
import ConfigPanel from "@/components/ConfigPanel";
import DebateView from "@/components/DebateView";
import AuthModal from "@/components/AuthModal";
import HistoryPanel from "@/components/HistoryPanel";
import type {
  DebateConfig,
  DebateRequest,
  Round,
  SSEEvent,
  StatusReport,
  UserKeys,
} from "@/lib/types";
import { getPhilosopher } from "@/lib/philosophers";
import { t, type Locale } from "@/lib/i18n";

const DEFAULT_CONFIG: DebateConfig = {
  rounds: { min: 2, max: 5 },
  convergence: { threshold: 7, checkAfterMin: true },
  contextWindow: "last_1",
  debaters: [
    { name: getPhilosopher(0).name.toLowerCase(), provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
    { name: getPhilosopher(1).name.toLowerCase(), provider: "openrouter", model: "google/gemma-3-27b-it:free" },
    { name: getPhilosopher(2).name.toLowerCase(), provider: "openrouter", model: "nvidia/nemotron-3-nano-30b-a3b:free" },
  ],
  judge: { provider: "openrouter", model: "openai/gpt-oss-120b:free" },
};

function loadKeys(): UserKeys {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("elenchus_keys") || "{}");
  } catch {
    return {};
  }
}

function saveKeys(keys: UserKeys) {
  localStorage.setItem("elenchus_keys", JSON.stringify(keys));
}

export default function Home() {
  const [keys, setKeys] = useState<UserKeys>({});
  const [config, setConfig] = useState<DebateConfig>(DEFAULT_CONFIG);
  const [topic, setTopic] = useState("");
  const [showKeys, setShowKeys] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [reports, setReports] = useState<StatusReport[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [waitingForSteering, setWaitingForSteering] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [accumulatedRounds, setAccumulatedRounds] = useState<Round[]>([]);
  const [debateId, setDebateId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const roundsRef = useRef<Round[]>([]);

  // Hydrate keys from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setKeys(loadKeys());
  }, []);

  // Check auth status on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const hasKeys = Object.values(keys).some((k) => k?.trim());

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    setUser(null);
  };

  const startDebate = useCallback(
    async (steering?: string) => {
      if (!topic.trim()) return;

      // Fresh debate — clear everything
      if (!steering) {
        setEvents([]);
        setReports([]);
        setAccumulatedRounds([]);
        roundsRef.current = [];
        setCurrentRound(0);
        setDebateId(null);
      }
      setIsRunning(true);
      setWaitingForSteering(false);

      const controller = new AbortController();
      abortRef.current = controller;

      const body: DebateRequest = {
        topic,
        config,
        keys,
        steering,
        previousRounds: steering ? roundsRef.current : undefined,
        debateId: steering ? debateId ?? undefined : undefined,
      };

      try {
        const res = await fetch("/api/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          setEvents((prev) => [
            ...prev,
            { type: "error", message: err.error || "Request failed" },
          ]);
          setIsRunning(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              setEvents((prev) => [...prev, event]);

              if (event.type === "debate_meta") {
                setDebateId(event.debateId);
              }
              if (event.type === "round_start") {
                setCurrentRound(event.round);
              }
              if (event.type === "status_report") {
                setReports((prev) => [...prev, event.report]);
              }
              if (event.type === "round_complete") {
                setAccumulatedRounds((prev) => {
                  const next = [...prev, event.round];
                  roundsRef.current = next;
                  return next;
                });
              }
              if (event.type === "waiting_for_steering") {
                setWaitingForSteering(true);
              }
              if (event.type === "debate_complete") {
                setIsRunning(false);
              }
            } catch {
              // skip malformed
            }
          }
        }

        setIsRunning(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setEvents((prev) => [
            ...prev,
            {
              type: "error",
              message: err instanceof Error ? err.message : "Unknown error",
            },
          ]);
        }
        setIsRunning(false);
      }
    },
    [topic, config, keys, debateId]
  );

  const handleSteering = (text: string) => {
    setWaitingForSteering(false);
    startDebate(text || undefined);
  };

  const handleFinalize = () => {
    setWaitingForSteering(false);
    setIsRunning(false);
    // Add a debate_complete event
    setEvents((prev) => [
      ...prev,
      { type: "debate_complete", totalRounds: roundsRef.current.length },
    ]);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setWaitingForSteering(false);
  };

  const loadSavedDebate = async (id: string) => {
    setShowHistory(false);
    try {
      const res = await fetch(`/api/debates/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const debate = data.debate;
      const rounds: Round[] = data.rounds ?? [];

      setTopic(debate.topic);
      setConfig(debate.config);
      setDebateId(debate.id);
      roundsRef.current = rounds;
      setAccumulatedRounds(rounds);

      // Reconstruct events and reports from saved rounds
      const reconstructedEvents: SSEEvent[] = [];
      const reconstructedReports: StatusReport[] = [];

      for (const round of rounds) {
        reconstructedEvents.push({
          type: "round_start",
          round: round.roundNumber,
          maxRounds: debate.config.rounds.max,
        });
        for (const resp of round.debaterResponses) {
          reconstructedEvents.push({
            type: "debater_done",
            name: resp.debaterName,
            content: resp.content,
          });
        }
        reconstructedReports.push({
          roundNumber: round.roundNumber,
          debaterSummaries: Object.fromEntries(
            round.debaterResponses.map((r) => [r.debaterName, r.content])
          ),
          convergenceScore: round.judgeEvaluation.convergenceScore,
          judgeReasoning: round.judgeEvaluation.rationale,
          agreements: round.judgeEvaluation.agreements,
          disagreements: round.judgeEvaluation.disagreements,
          isFinal: round.roundNumber === rounds.length,
        });
      }

      if (debate.status === "completed" || debate.status === "stopped") {
        reconstructedEvents.push({
          type: "debate_complete",
          totalRounds: rounds.length,
        });
      }

      setEvents(reconstructedEvents);
      setReports(reconstructedReports);
      setCurrentRound(rounds.length);
      setIsRunning(false);
      setWaitingForSteering(false);
    } catch {
      // ignore
    }
  };

  return (
    <main className="min-h-screen relative z-10">
      {/* Header */}
      <header className="px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Image src="/logo.svg" alt="Elenchus logo" width={150} height={150} className="opacity-80" />
            <h1
              className="text-xl tracking-wide text-[var(--accent)]"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              ELENCHOS
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === "en" ? "tr" : "en")}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)] transition-all"
              style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "0.06em" }}
            >
              {locale === "en" ? "TR" : "EN"}
            </button>
            {user && (
              <button
                onClick={() => setShowHistory(true)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)] transition-all"
                style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "0.06em" }}
              >
                {t("header.history", locale)}
              </button>
            )}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                showConfig
                  ? "border-[var(--accent-dim)] bg-[var(--accent-glow)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)]"
              }`}
              style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "0.06em" }}
            >
              {t("header.config", locale)}
            </button>
            <button
              onClick={() => setShowKeys(true)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                hasKeys
                  ? "border-[var(--green)]/30 text-[var(--green)]"
                  : "border-[var(--orange)]/30 text-[var(--orange)]"
              }`}
              style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "0.06em" }}
            >
              {hasKeys ? t("header.keysSet", locale) : t("header.addKeys", locale)}
            </button>
            {user ? (
              <button
                onClick={handleSignOut}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)] transition-all"
                style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "0.06em" }}
                title={user.email}
              >
                {t("header.signOut", locale)}
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:border-[var(--border-accent)] hover:text-[var(--text-secondary)] transition-all"
                style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "0.06em" }}
              >
                {t("header.signIn", locale)}
              </button>
            )}
          </div>
        </div>
        <div className="marble-divider max-w-4xl mx-auto mt-4" />
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Config Panel */}
        {showConfig && (
          <div className="mb-6 card-marble rounded-xl p-5 animate-fade-in">
            <div className="relative z-10">
              <h2
                className="text-sm mb-5"
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", color: "var(--text-dim)" }}
              >
                {t("debate.configTitle", locale)}
              </h2>
              <ConfigPanel config={config} onChange={setConfig} />
            </div>
          </div>
        )}

        {/* Hero / Topic Input */}
        {!isRunning && reports.length === 0 && (
          <div className="animate-fade-in">
            <div className="text-center mb-10 mt-8">
              <p
                className="text-[var(--accent-dim)] text-sm tracking-widest mb-3"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {t("hero.subtitle", locale)}
              </p>
              <h2
                className="text-3xl mb-4 text-[var(--text)]"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 500, letterSpacing: "0.02em" }}
              >
                {t("hero.title", locale)}
              </h2>
              <p className="text-[var(--text-muted)] max-w-md mx-auto text-base italic">
                {t("hero.description", locale)}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                startDebate();
              }}
              className="max-w-2xl mx-auto"
            >
              <div className="relative">
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("hero.placeholder", locale)}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 pr-28 text-base text-[var(--text)] placeholder:text-[var(--text-dim)] placeholder:italic focus:border-[var(--accent-dim)] focus:outline-none resize-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={!topic.trim() || !hasKeys}
                  className="absolute right-3 bottom-3 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--bg-card)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
                >
                  {t("hero.begin", locale)}
                </button>
              </div>
              {!hasKeys && (
                <p className="text-xs text-[var(--orange)] mt-2 text-center italic">
                  {t("hero.noKeys", locale)}
                  <button type="button" onClick={() => setShowKeys(true)} className="underline">
                    {t("hero.setKeys", locale)}
                  </button>
                </p>
              )}
            </form>

            {/* Decorative footer */}
            <div className="flex items-center justify-center gap-3 mt-12 text-[var(--text-dim)]">
              <div className="marble-divider flex-1 max-w-[80px]" />
              <span
                className="text-xs tracking-widest"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {"ΣΩΚΡΑΤΗΣ · ΠΛΑΤΩΝ · ΑΡΙΣΤΟΤΕΛΗΣ"}
              </span>
              <div className="marble-divider flex-1 max-w-[80px]" />
            </div>
          </div>
        )}

        {/* Debate Output */}
        {(isRunning || reports.length > 0) && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-sm text-[var(--text-secondary)]"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
                >
                  {t("debate.onTheMatter", locale)}
                </h2>
                <p className="text-base text-[var(--text)] mt-1 italic">{topic}</p>
                {currentRound > 0 && (
                  <span className="text-xs text-[var(--text-dim)]">{t("debate.round", locale)} {currentRound}</span>
                )}
              </div>
              {isRunning && (
                <button
                  onClick={handleStop}
                  className="rounded-lg border border-[var(--red)] px-3 py-1.5 text-xs text-[var(--red)] hover:bg-[var(--red)] hover:text-[var(--bg-card)] transition-colors"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
                >
                  {t("debate.stop", locale)}
                </button>
              )}
              {!isRunning && reports.length > 0 && (
                <button
                  onClick={() => {
                    setEvents([]);
                    setReports([]);
                    setAccumulatedRounds([]);
                    roundsRef.current = [];
                    setTopic("");
                    setCurrentRound(0);
                    setDebateId(null);
                  }}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent-dim)] hover:text-[var(--accent)] transition-colors"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
                >
                  {t("debate.newDebate", locale)}
                </button>
              )}
            </div>
            <DebateView
              events={events}
              reports={reports}
              isRunning={isRunning}
              waitingForSteering={waitingForSteering}
              currentRound={currentRound}
              debaters={config.debaters}
              onSteering={handleSteering}
              onSkipSteering={() => handleSteering("")}
              onFinalize={handleFinalize}
              locale={locale}
            />
          </div>
        )}
      </div>

      {/* Keys Modal */}
      {showKeys && (
        <KeysModal
          keys={keys}
          onSave={(newKeys) => {
            setKeys(newKeys);
            saveKeys(newKeys);
            setShowKeys(false);
          }}
          onClose={() => setShowKeys(false)}
        />
      )}

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onSuccess={(u) => {
            setUser(u);
            setShowAuth(false);
          }}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel
          onLoadDebate={loadSavedDebate}
          onClose={() => setShowHistory(false)}
        />
      )}
    </main>
  );
}
