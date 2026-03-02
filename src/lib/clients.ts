/**
 * LLM client factory — creates a `complete(system, user)` function for each provider.
 * All providers use their official SDKs or OpenAI-compatible endpoints.
 */

import type { UserKeys } from "./types";

export type CompleteFn = (system: string, user: string) => Promise<string>;

/** Build a completion function for the given provider + model using user-supplied keys. */
export function createClient(
  provider: string,
  model: string,
  keys: UserKeys
): CompleteFn {
  switch (provider) {
    case "openai":
      return openaiComplete(keys.openai!, model);
    case "anthropic":
      return anthropicComplete(keys.anthropic!, model);
    case "gemini":
      return geminiComplete(keys.gemini!, model);
    case "openrouter":
      return openrouterComplete(keys.openrouter!, model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── OpenAI ──────────────────────────────────────────────────────────────────

function openaiComplete(apiKey: string, model: string): CompleteFn {
  return async (system, user) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  };
}

// ── Anthropic ───────────────────────────────────────────────────────────────

function anthropicComplete(apiKey: string, model: string): CompleteFn {
  return async (system, user) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic ${res.status}: ${err}`);
    }
    const data = await res.json();
    return (
      data.content
        ?.filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("") ?? ""
    );
  };
}

// ── Gemini ──────────────────────────────────────────────────────────────────

function geminiComplete(apiKey: string, model: string): CompleteFn {
  return async (system, user) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  };
}

// ── OpenRouter (OpenAI-compatible) ──────────────────────────────────────────

function openrouterComplete(apiKey: string, model: string): CompleteFn {
  return async (system, user) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  };
}
