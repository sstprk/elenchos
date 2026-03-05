"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { SSEEvent, StatusReport, DebaterConfig } from "@/lib/types";
import { debaterNameToPhilosopher, JUDGE_PERSONA } from "@/lib/philosophers";
import { t, type Locale } from "@/lib/i18n";

interface DebateViewProps {
  events: SSEEvent[];
  reports: StatusReport[];
  isRunning: boolean;
  waitingForSteering: boolean;
  currentRound: number;
  onSteering: (msg: string) => void;
  onSkipSteering: () => void;
  onFinalize: () => void;
  debaters: DebaterConfig[];
  locale: Locale;
}

function PhilosopherAvatar({ name, allNames }: { name: string; allNames: string[] }) {
  const phil = debaterNameToPhilosopher(name, allNames);
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
      style={{
        background: phil.color + "14",
        color: phil.color,
      }}
    >
      {phil.icon}
    </div>
  );
}

function ConvergenceBadge({ score }: { score: number }) {
  const pct = score * 10;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: pct + "%",
            background: score >= 7 ? "var(--green)" : score >= 4 ? "var(--accent)" : "var(--red)",
          }}
        />
      </div>
      <span
        className="text-xs font-bold min-w-[2rem] text-right font-mono"
        style={{
          color: score >= 7 ? "var(--green)" : score >= 4 ? "var(--accent)" : "var(--red)",
        }}
      >
        {score}/10
      </span>
    </div>
  );
}

function EventCard({
  event,
  allNames,
  locale,
}: {
  event: SSEEvent;
  allNames: string[];
  locale: Locale;
}) {
  switch (event.type) {
    case "round_start":
      return (
        <div className="py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs font-medium text-[var(--text-dim)] px-2">
              {t("debate.round", locale)} {event.round} {t("view.roundOf", locale)} {event.maxRounds}
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
        </div>
      );

    case "debater_start":
      return (
        <div className="flex items-center gap-2 px-1 py-1">
          <PhilosopherAvatar name={event.name} allNames={allNames} />
          <span className="text-sm text-[var(--text-dim)]">
            <span
              className="font-medium"
              style={{ color: debaterNameToPhilosopher(event.name, allNames).color }}
            >
              {debaterNameToPhilosopher(event.name, allNames).name}
            </span>{" "}
            {t("view.speaks", locale)}
            <span className="text-xs font-mono text-[var(--text-dim)] ml-1.5">({event.model})</span>
            <span className="animate-pulse ml-1">...</span>
          </span>
        </div>
      );

    case "debater_done": {
      const phil = debaterNameToPhilosopher(event.name, allNames);
      return (
        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 animate-slide-in">
          <div className="flex items-start gap-3">
            <PhilosopherAvatar name={event.name} allNames={allNames} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold" style={{ color: phil.color }}>
                  {phil.name}
                </span>
                <span className="text-xs text-[var(--text-dim)]">{phil.title}</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-[var(--text)] prose-headings:text-[var(--text)] prose-headings:text-sm prose-headings:mt-3 prose-headings:mb-1">
                <ReactMarkdown>{event.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "judge_start":
      return (
        <div className="flex items-center gap-2 px-1 py-1 mt-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: JUDGE_PERSONA.color + "14", color: JUDGE_PERSONA.color }}
          >
            {JUDGE_PERSONA.icon}
          </div>
          <span className="text-sm text-[var(--text-dim)]">
            <span className="font-medium" style={{ color: JUDGE_PERSONA.color }}>
              {JUDGE_PERSONA.name}
            </span>{" "}
            {t("view.deliberates", locale)}
            <span className="animate-pulse ml-1">...</span>
          </span>
        </div>
      );

    case "debate_complete":
      return (
        <div className="py-3 text-center">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--green)]/20" />
            <span className="text-sm font-medium text-[var(--green)]">
              {t("view.concludes", locale)}
            </span>
            <div className="flex-1 h-px bg-[var(--green)]/20" />
          </div>
        </div>
      );

    case "error":
      return (
        <div className="px-4 py-3 rounded-xl border border-[var(--red)]/15 bg-[var(--red-dim)] text-sm text-[var(--red)] animate-fade-in">
          ⚠ {event.message}
        </div>
      );

    default:
      return null;
  }
}

function ReportCard({ report, index, total, locale }: { report: StatusReport; index: number; total: number; locale: Locale }) {
  const isLast = index === total - 1;
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] border-l-2 border-l-[var(--accent-dim)] p-4 animate-slide-in">
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
          style={{ background: JUDGE_PERSONA.color + "14", color: JUDGE_PERSONA.color }}
        >
          {JUDGE_PERSONA.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: JUDGE_PERSONA.color }}>
              {isLast ? t("view.finalVerdict", locale) : t("debate.round", locale) + " " + report.roundNumber + " \u2014 " + t("view.assessment", locale)}
            </span>
          </div>
          <ConvergenceBadge score={report.convergenceScore} />
          {report.judgeReasoning && (
            <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
              {report.judgeReasoning}
            </p>
          )}

          {/* Agreements */}
          {report.agreements && report.agreements.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--green)] mb-1.5">
                {t("view.agreements", locale)}
              </h4>
              <ul className="space-y-1">
                {report.agreements.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-muted)] leading-relaxed">
                    <span className="text-[var(--green)] mt-0.5 shrink-0">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disagreements */}
          {report.disagreements && report.disagreements.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--red)] mb-1.5">
                {t("view.disagreements", locale)}
              </h4>
              <ul className="space-y-1">
                {report.disagreements.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-muted)] leading-relaxed">
                    <span className="text-[var(--red)] mt-0.5 shrink-0">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SteeringInput({
  onSteering,
  onSkip,
  onFinalize,
  locale,
}: {
  onSteering: (msg: string) => void;
  onSkip: () => void;
  onFinalize: () => void;
  locale: Locale;
}) {
  const [msg, setMsg] = useState("");
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 animate-slide-in">
      <p className="text-sm font-semibold text-[var(--text)] mb-1">
        {t("steering.title", locale)}
      </p>
      <p className="text-xs text-[var(--text-dim)] mb-3">
        {t("steering.description", locale)}
      </p>
      <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 focus-within:border-[var(--border-accent)] transition-colors">
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && msg.trim()) {
              e.preventDefault();
              onSteering(msg);
              setMsg("");
            }
          }}
          placeholder={t("steering.placeholder", locale)}
          className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none resize-none leading-6"
          rows={1}
        />
        <button
          onClick={() => {
            onSteering(msg);
            setMsg("");
          }}
          disabled={!msg.trim()}
          className="shrink-0 w-7 h-7 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center hover:bg-[var(--accent-hover)] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onSkip}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-warm)] transition-colors"
        >
          {t("steering.continue", locale)}
        </button>
        <button
          onClick={onFinalize}
          className="rounded-lg border border-[var(--green)]/30 px-3 py-1.5 text-xs font-medium text-[var(--green)] hover:bg-[var(--green-dim)] transition-colors ml-auto"
        >
          {t("steering.finalize", locale)}
        </button>
      </div>
    </div>
  );
}

export default function DebateView(props: DebateViewProps) {
  const { events, reports, isRunning, waitingForSteering, onSteering, onSkipSteering, onFinalize, debaters, locale } = props;
  const allNames = debaters.map((d) => d.name);

  const items: { key: string; el: React.ReactNode }[] = [];
  let reportIdx = 0;

  events.forEach((ev, i) => {
    items.push({ key: "ev-" + i, el: <EventCard event={ev} allNames={allNames} locale={locale} /> });

    if (ev.type === "round_start" && ev.round > 1) {
      const r = reports[reportIdx];
      if (r) {
        items.push({
          key: "rpt-" + reportIdx,
          el: <ReportCard report={r} index={reportIdx} total={reports.length} locale={locale} />,
        });
        reportIdx++;
      }
    }
  });

  while (reportIdx < reports.length) {
    items.push({
      key: "rpt-" + reportIdx,
      el: <ReportCard report={reports[reportIdx]} index={reportIdx} total={reports.length} locale={locale} />,
    });
    reportIdx++;
  }

  return (
    <div className="space-y-3 pb-4">
      {items.map((item) => (
        <div key={item.key}>{item.el}</div>
      ))}

      {waitingForSteering && (
        <SteeringInput onSteering={onSteering} onSkip={onSkipSteering} onFinalize={onFinalize} locale={locale} />
      )}

      {isRunning && !waitingForSteering && (
        <div className="flex items-center gap-2.5 py-4 px-1">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)] animate-pulse" style={{ animationDelay: "0s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)] animate-pulse" style={{ animationDelay: "0.2s" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)] animate-pulse" style={{ animationDelay: "0.4s" }} />
          </div>
          <span className="text-sm text-[var(--text-dim)]">{t("view.thinking", locale)}</span>
        </div>
      )}
    </div>
  );
}
