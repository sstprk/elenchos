"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Whether a debate has been started (input moves to bottom)
  const hasStarted = isRunning || reports.length > 0 || events.length > 0;

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

  // Auto-scroll to bottom when new events come in
  useLayoutEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, reports]);

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
    <main className="flex flex-col h-screen relative z-10 bg-gradient-to-br from-[var(--bg)] to-[var(--bg-warm)]">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-md shadow-lg">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Elenchos logo" width={28} height={28} className="opacity-90" />
            <span className="text-base font-semibold text-[var(--text)]">Elenchos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLocale(locale === "en" ? "tr" : "en")}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-warm)] transition-colors"
            >
              {locale === "en" ? "TR" : "EN"}
            </button>
            {user && (
              <button
                onClick={() => setShowHistory(true)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-warm)] transition-colors"
              >
                {t("header.history", locale)}
              </button>
            )}
            <button
              onClick={() => setShowConfig(true)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-warm)] transition-colors"
            >
              {t("header.config", locale)}
            </button>
            <button
              onClick={() => setShowKeys(true)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                hasKeys
                  ? "text-[var(--green)] hover:bg-[var(--green-dim)]"
                  : "text-[var(--orange)] hover:bg-[var(--bg-warm)]"
              }`}
            >
              {hasKeys ? t("header.keysSet", locale) : t("header.addKeys", locale)}
            </button>
            {user ? (
              <button
                onClick={handleSignOut}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-warm)] transition-colors"
                title={user.email}
              >
                {t("header.signOut", locale)}
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-warm)] transition-colors"
              >
                {t("header.signIn", locale)}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
        {/* Centered landing state — input in the middle */}
        {!hasStarted && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in px-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-[var(--text)] mb-2">
                {t("hero.title", locale)}
              </h2>
              <p className="text-[var(--text-muted)] max-w-md mx-auto text-sm">
                {t("hero.description", locale)}
              </p>
            </div>
            <div className="w-full max-w-2xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  startDebate();
                }}
              >
                <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 focus-within:border-[var(--border-accent)] transition-colors shadow-xl ring-1 ring-transparent focus-within:ring-[var(--border-accent)]">
                  <textarea
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (topic.trim() && hasKeys) startDebate();
                      }
                    }}
                    placeholder={t("hero.placeholder", locale)}
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none resize-none leading-6 max-h-[150px]"
                  />
                  <button
                    type="submit"
                    disabled={!topic.trim() || !hasKeys}
                    className="shrink-0 w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent-hover)] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                {!hasKeys && (
                  <p className="text-xs text-[var(--text-dim)] mt-2 text-center">
                    {t("hero.noKeys", locale)}
                    <button type="button" onClick={() => setShowKeys(true)} className="text-[var(--orange)] underline">
                      {t("hero.setKeys", locale)}
                    </button>
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Active debate content */}
        {hasStarted && (
          <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)] truncate">{topic}</p>
                {currentRound > 0 && (
                  <span className="text-xs text-[var(--text-dim)]">{t("debate.round", locale)} {currentRound}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isRunning && (
                  <button
                    onClick={handleStop}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--red)] hover:bg-[var(--red-dim)] transition-colors"
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
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-warm)] transition-colors"
                  >
                    {t("debate.newDebate", locale)}
                  </button>
                )}
              </div>
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
            <div ref={bottomRef} />
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

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfig(false)} />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                {t("debate.configTitle", locale)}
              </h2>
              <button
                onClick={() => setShowConfig(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-warm)] hover:text-[var(--text)] transition-colors"
              >
                ✕
              </button>
            </div>
            <ConfigPanel config={config} onChange={setConfig} />
            <div className="h-px bg-[var(--border)] mt-6 mb-4" />
            <div className="flex justify-end">
              <button
                onClick={() => setShowConfig(false)}
                className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-all"
              >
                {t("config.save", locale)}
              </button>
            </div>
          </div>
        </div>
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
