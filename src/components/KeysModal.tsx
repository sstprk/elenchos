"use client";

import { useState } from "react";
import type { UserKeys } from "@/lib/types";

const PROVIDERS = [
  {
    id: "openrouter" as const,
    name: "OpenRouter",
    placeholder: "sk-or-v1-...",
    hint: "Free models available — recommended for getting started",
    url: "https://openrouter.ai/keys",
    icon: "\u25C8",
  },
  {
    id: "openai" as const,
    name: "OpenAI",
    placeholder: "sk-...",
    hint: "GPT-4o and other models",
    url: "https://platform.openai.com/api-keys",
    icon: "\u25C7",
  },
  {
    id: "anthropic" as const,
    name: "Anthropic",
    placeholder: "sk-ant-...",
    hint: "Claude Sonnet and other models",
    url: "https://console.anthropic.com/settings/keys",
    icon: "\u25C6",
  },
  {
    id: "gemini" as const,
    name: "Google Gemini",
    placeholder: "AIza...",
    hint: "Gemini Flash and Pro models",
    url: "https://aistudio.google.com/apikey",
    icon: "\u25CA",
  },
];

interface KeysModalProps {
  keys: UserKeys;
  onSave: (keys: UserKeys) => void;
  onClose: () => void;
}

export default function KeysModal({ keys, onSave, onClose }: KeysModalProps) {
  const [draft, setDraft] = useState<UserKeys>({ ...keys });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-xl animate-fade-in">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-[var(--text)]">
                API Keys
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Keys are stored in your browser only &mdash; never sent to any server but the provider&apos;s.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-warm)] hover:text-[var(--text)] transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {PROVIDERS.map((p) => {
              const hasKey = !!draft[p.id]?.trim();
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <span className="text-[var(--text-dim)]">{p.icon}</span>
                      {p.name}
                      {hasKey && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                      )}
                    </label>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent-dim)] hover:text-[var(--accent)] transition-colors"
                    >
                      Get key &rarr;
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder={p.placeholder}
                    value={draft[p.id] ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [p.id]: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent-dim)] focus:outline-none transition-colors"
                  />
                  <p className="text-xs text-[var(--text-dim)] mt-1 italic">{p.hint}</p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(draft)}
              className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              Save Keys
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
