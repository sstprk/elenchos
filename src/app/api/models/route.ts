/**
 * GET /api/models
 * Fetches available free models from OpenRouter and returns a simplified list.
 * Cached for 1 hour to avoid hammering the API.
 */

export const dynamic = "force-dynamic";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
  top_provider?: { max_completion_tokens: number };
}

interface SimpleModel {
  id: string;
  name: string;
  contextLength: number;
}

let cache: { models: SimpleModel[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  // Return cached if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return Response.json({ models: cache.models });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      return Response.json(
        { error: "Failed to fetch models from OpenRouter" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const allModels: OpenRouterModel[] = data.data ?? [];

    // Filter to free models only (prompt and completion both "0")
    const freeModels: SimpleModel[] = allModels
      .filter(
        (m) =>
          m.pricing &&
          parseFloat(m.pricing.prompt) === 0 &&
          parseFloat(m.pricing.completion) === 0
      )
      .map((m) => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    cache = { models: freeModels, ts: Date.now() };

    return Response.json({ models: freeModels });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
