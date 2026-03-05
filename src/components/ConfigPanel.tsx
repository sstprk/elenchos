"use client";

import { useCallback, useEffect, useState } from "react";
import type { DebateConfig, DebaterConfig, JudgeConfig } from "@/lib/types";
import { getPhilosopher, JUDGE_PERSONA } from "@/lib/philosophers";

interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
}

interface ConfigPanelProps {
  config: DebateConfig;
  onChange: (config: DebateConfig) => void;
}

const PRESETS: {
  label: string;
  desc: string;
  provider: DebaterConfig["provider"];
  models: string[];
  judgeModel: string;
}[] = [
  {
    label: "Agora Libre",
    desc: "Free OpenRouter models",
    provider: "openrouter",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
    ],
    judgeModel: "openai/gpt-oss-120b:free",
  },
  {
    label: "Olympus",
    desc: "OpenAI GPT-4o",
    provider: "openai",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4o"],
    judgeModel: "gpt-4o",
  },
  {
    label: "Oracle",
    desc: "Google Gemini 2.5 Flash",
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash"],
    judgeModel: "gemini-2.5-flash",
  },
  {
    label: "Lyceum",
    desc: "Anthropic Claude Sonnet",
    provider: "anthropic",
    models: ["claude-sonnet-4-20250514", "claude-sonnet-4-20250514", "claude-sonnet-4-20250514"],
    judgeModel: "claude-sonnet-4-20250514",
  },
];

function Info({ text }: { text: string }) {
  return (
    <span className="tooltip-trigger inline-flex items-center ml-1.5 cursor-help">
      <span className="w-3.5 h-3.5 rounded-full border border-[var(--border-accent)] text-[var(--text-dim)] text-[10px] flex items-center justify-center leading-none">
        ?
      </span>
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

export default function ConfigPanel({ config, onChange }: ConfigPanelProps) {
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/models");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOpenRouterModels(data.models ?? []);
    } catch {
      setModelsError("Could not load models");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const usesOpenRouter =
    config.debaters.some((d) => d.provider === "openrouter") ||
    config.judge.provider === "openrouter";

  const applyPreset = (idx: number) => {
    const preset = PRESETS[idx];
    const debaters: DebaterConfig[] = preset.models.map((model, i) => ({
      name: getPhilosopher(i).name.toLowerCase(),
      provider: preset.provider,
      model,
    }));
    const judge: JudgeConfig = { provider: preset.provider, model: preset.judgeModel };
    onChange({ ...config, debaters, judge });
  };

  const updateDebater = (index: number, updates: Partial<DebaterConfig>) => {
    const debaters = [...config.debaters];
    debaters[index] = { ...debaters[index], ...updates };
    onChange({ ...config, debaters });
  };

  const addDebater = () => {
    const nextIdx = config.debaters.length;
    if (nextIdx >= 8) return;
    const phil = getPhilosopher(nextIdx);
    const newDebater: DebaterConfig = {
      name: phil.name.toLowerCase(),
      provider: "openrouter",
      model: openRouterModels[0]?.id ?? "meta-llama/llama-3.3-70b-instruct:free",
    };
    onChange({ ...config, debaters: [...config.debaters, newDebater] });
  };

  const removeDebater = (index: number) => {
    if (config.debaters.length <= 2) return;
    const debaters = config.debaters.filter((_, i) => i !== index);
    onChange({ ...config, debaters });
  };

  const updateJudge = (updates: Partial<JudgeConfig>) => {
    onChange({ ...config, judge: { ...config.judge, ...updates } });
  };

  const renderModelSelector = (
    provider: string,
    model: string,
    onModelChange: (m: string) => void
  ) => {
    if (provider === "openrouter" && openRouterModels.length > 0) {
      return (
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] font-mono focus:border-[var(--accent-dim)] focus:outline-none truncate"
        >
          {model && !openRouterModels.some((m) => m.id === model) && (
            <option value={model}>{model}</option>
          )}
          {openRouterModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({Math.round(m.contextLength / 1024)}k)
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        placeholder="Model ID (e.g. gpt-4o)"
        className="rounded border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] font-mono placeholder:text-[var(--text-dim)] focus:border-[var(--accent-dim)] focus:outline-none"
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Presets */}
      <section>
        <div className="flex items-center mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Presets</h3>
          <Info text="Quick configurations that set all debaters and judge to a specific provider. You can customize individual settings after applying." />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)}
              className="group rounded-lg border border-[var(--border)] px-3 py-2.5 text-left hover:border-[var(--accent-dim)] hover:bg-[var(--accent-glow)] transition-all">
              <span className="block text-sm font-semibold text-[var(--text-secondary)] group-hover:text-[var(--accent)]">{p.label}</span>
              <span className="block text-xs text-[var(--text-dim)] mt-0.5">{p.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="marble-divider" />

      {/* Debaters */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Debaters</h3>
            <Info text="Each debater is an independent LLM arguing from its own perspective. More debaters = more diverse viewpoints but slower rounds." />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-dim)]">{config.debaters.length}/8</span>
            <button onClick={addDebater} disabled={config.debaters.length >= 8}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent-dim)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              + Add
            </button>
          </div>
        </div>
        <div className="space-y-2.5">
          {config.debaters.map((debater, i) => {
            const phil = getPhilosopher(i);
            return (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--bg-warm)] p-3 animate-fade-in">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: phil.color + "18", color: phil.color, border: "1px solid " + phil.color + "30" }}>
                    {phil.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[var(--text)]">{phil.name}</span>
                    <span className="text-xs text-[var(--text-dim)] ml-1.5 italic">{phil.title}</span>
                  </div>
                  <button onClick={() => removeDebater(i)} disabled={config.debaters.length <= 2}
                    className="text-[var(--text-dim)] hover:text-[var(--red)] disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-sm px-1">
                    &times;
                  </button>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <select value={debater.provider}
                    onChange={(e) => updateDebater(i, { provider: e.target.value as DebaterConfig["provider"], model: "" })}
                    className="rounded border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent-dim)] focus:outline-none">
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Gemini</option>
                  </select>
                  {renderModelSelector(debater.provider, debater.model, (m) => updateDebater(i, { model: m }))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="marble-divider" />

      {/* Judge */}
      <section>
        <div className="flex items-center mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Judge</h3>
          <Info text="The Judge evaluates all debater responses, scores convergence, and frames the next round. Choose a capable model for best analysis quality." />
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-warm)] p-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: JUDGE_PERSONA.color + "18", color: JUDGE_PERSONA.color, border: "1px solid " + JUDGE_PERSONA.color + "30" }}>
              {JUDGE_PERSONA.icon}
            </div>
            <div>
              <span className="text-sm font-semibold text-[var(--text)]">{JUDGE_PERSONA.name}</span>
              <span className="text-xs text-[var(--text-dim)] ml-1.5 italic">{JUDGE_PERSONA.title}</span>
            </div>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <select value={config.judge.provider}
              onChange={(e) => updateJudge({ provider: e.target.value as JudgeConfig["provider"], model: "" })}
              className="rounded border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent-dim)] focus:outline-none">
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </select>
            {renderModelSelector(config.judge.provider, config.judge.model, (m) => updateJudge({ model: m }))}
          </div>
        </div>
      </section>

      <div className="marble-divider" />

      {/* Rounds */}
      <section>
        <div className="flex items-center mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Rounds</h3>
          <Info text="Min: debate always runs at least this many rounds. Max: hard cap. More rounds = deeper exploration but longer runtime." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--text-dim)] mb-1 block">Minimum</label>
            <input type="number" min={1} max={10} value={config.rounds.min}
              onChange={(e) => onChange({ ...config, rounds: { ...config.rounds, min: +e.target.value } })}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent-dim)] focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-dim)] mb-1 block">Maximum</label>
            <input type="number" min={1} max={10} value={config.rounds.max}
              onChange={(e) => onChange({ ...config, rounds: { ...config.rounds, max: +e.target.value } })}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent-dim)] focus:outline-none" />
          </div>
        </div>
      </section>

      {/* Convergence */}
      <section>
        <div className="flex items-center mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Convergence</h3>
          <Info text="The judge scores agreement (1-10) after each round. When this score meets your threshold, debate ends early. Lower = ends sooner. Higher = forces deeper consensus." />
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-warm)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-secondary)]">Threshold</span>
            <span className="text-lg font-bold text-[var(--accent)]">{config.convergence.threshold}/10</span>
          </div>
          <input type="range" min={1} max={10} value={config.convergence.threshold}
            onChange={(e) => onChange({ ...config, convergence: { ...config.convergence, threshold: +e.target.value } })}
            className="w-full accent-[var(--accent)] cursor-pointer" />
          <div className="flex justify-between text-xs text-[var(--text-dim)] mt-1">
            <span>1 &mdash; Barely agree</span>
            <span>10 &mdash; Full consensus</span>
          </div>
          <label className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)] cursor-pointer">
            <input type="checkbox" checked={config.convergence.checkAfterMin}
              onChange={(e) => onChange({ ...config, convergence: { ...config.convergence, checkAfterMin: e.target.checked } })}
              className="accent-[var(--accent)]" />
            <span className="text-sm text-[var(--text-secondary)]">Only check after minimum rounds</span>
            <Info text="Ensures the debate runs for at least the minimum rounds before convergence can end it early." />
          </label>
        </div>
      </section>

      {/* Context Window */}
      <section>
        <div className="flex items-center mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Context Window</h3>
          <Info text="How much history each debater sees. 'Last round' is cheaper on tokens. 'Full history' gives best continuity but may hit context limits." />
        </div>
        <div className="flex gap-2">
          {([
            { value: "last_1" as const, label: "Last round", desc: "Token-efficient" },
            { value: "full" as const, label: "Full history", desc: "Best continuity" },
          ]).map((opt) => (
            <button key={opt.value} onClick={() => onChange({ ...config, contextWindow: opt.value })}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-all ${
                config.contextWindow === opt.value
                  ? "border-[var(--accent-dim)] bg-[var(--accent-glow)]"
                  : "border-[var(--border)] hover:border-[var(--border-accent)]"
              }`}>
              <span className={`block text-sm font-medium ${
                config.contextWindow === opt.value ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
              }`}>{opt.label}</span>
              <span className="block text-xs text-[var(--text-dim)] mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Models status */}
      {usesOpenRouter && (
        <div className="flex items-center justify-between text-xs text-[var(--text-dim)] pt-2">
          <span>
            {loadingModels ? "Loading OpenRouter models..." : modelsError ? modelsError : openRouterModels.length + " free models available"}
          </span>
          {!loadingModels && (
            <button onClick={fetchModels} className="text-[var(--accent-dim)] hover:text-[var(--accent)] transition-colors">Refresh</button>
          )}
        </div>
      )}
    </div>
  );
}
