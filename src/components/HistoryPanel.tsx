"use client";

import { useEffect, useState } from "react";
import type { DbDebate } from "@/lib/db";

interface HistoryPanelProps {
  onLoadDebate: (debateId: string) => void;
  onClose: () => void;
}

export default function HistoryPanel({ onLoadDebate, onClose }: HistoryPanelProps) {
  const [debates, setDebates] = useState<DbDebate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDebates();
  }, []);

  const fetchDebates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/debates");
      if (!res.ok) return;
      const data = await res.json();
      setDebates(data.debates ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/debates?id=${id}`, { method: "DELETE" });
      setDebates((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // ignore
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "completed": return "Completed";
      case "in_progress": return "In Progress";
      case "stopped": return "Stopped";
      default: return s;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-2xl animate-fade-in flex flex-col">
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Saved Debates
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-warm)] hover:text-[var(--text)] transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {loading && (
              <p className="text-sm text-[var(--text-dim)] italic text-center py-8">Loading...</p>
            )}

            {!loading && debates.length === 0 && (
              <p className="text-sm text-[var(--text-dim)] italic text-center py-8">
                No debates saved yet. Start a debate while signed in to save it automatically.
              </p>
            )}

            {debates.map((debate) => (
              <div
                key={debate.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-warm)] p-3 hover:border-[var(--border-accent)] transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => onLoadDebate(debate.id)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm text-[var(--text)] line-clamp-2 leading-snug">
                      {debate.topic}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-[var(--text-dim)]">
                        {formatDate(debate.created_at)}
                      </span>
                      <span className="text-xs text-[var(--text-dim)]">
                        {debate.total_rounds} {debate.total_rounds === 1 ? "round" : "rounds"}
                      </span>
                      {debate.final_convergence_score != null && (
                        <span className="text-xs text-[var(--text-dim)]">
                          Score: {debate.final_convergence_score}/10
                        </span>
                      )}
                      <span
                        className={`text-xs ${
                          debate.status === "completed"
                            ? "text-[var(--green)]"
                            : debate.status === "stopped"
                            ? "text-[var(--red)]"
                            : "text-[var(--text-dim)]"
                        }`}
                      >
                        {statusLabel(debate.status)}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(debate.id);
                    }}
                    className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors text-sm px-1 opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
