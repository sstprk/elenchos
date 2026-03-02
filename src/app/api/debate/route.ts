/**
 * POST /api/debate
 * Accepts a DebateRequest, runs one round of the debate engine,
 * and streams SSE events back to the client.
 *
 * Vercel-compatible: uses Web Streams API with streaming response.
 */

import { runDebate } from "@/lib/engine";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createDebate, saveRound, updateDebateStatus } from "@/lib/db";
import type { DebateConfig, DebateRequest, SSEEvent, UserKeys } from "@/lib/types";

export const maxDuration = 300; // Vercel Pro: up to 300s, Free: 60s
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: DebateRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const { topic, config, keys, steering, previousRounds, debateId: existingDebateId } = body;

  // Validate required fields
  if (!topic?.trim()) {
    return new Response(JSON.stringify({ error: "Topic is required" }), {
      status: 400,
    });
  }

  // Validate that the user provided at least the keys needed by the chosen providers
  const missingKeys = validateKeys(config, keys);
  if (missingKeys.length > 0) {
    return new Response(
      JSON.stringify({
        error: `Missing API keys for: ${missingKeys.join(", ")}`,
      }),
      { status: 400 }
    );
  }

  // Check if user is authenticated (optional — debate works without auth)
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Create or reuse debate record if authenticated
  let debateId: string | null = existingDebateId ?? null;
  if (user && !debateId && !steering) {
    try {
      debateId = await createDebate(supabase, user.id, topic, config);
    } catch {
      // Non-fatal — debate runs without saving
    }
  }

  // Create a readable stream that emits SSE events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const emit = (event: SSEEvent) => {
        // Intercept round_complete events to save to DB
        if (event.type === "round_complete" && user && debateId) {
          saveRound(supabase, debateId, event.round).catch(() => {
            // Non-fatal
          });
        }
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Send debate ID to client so it can track the session
      if (debateId) {
        const meta = `data: ${JSON.stringify({ type: "debate_meta", debateId })}\n\n`;
        controller.enqueue(encoder.encode(meta));
      }

      try {
        await runDebate(topic, config, keys, emit, steering, previousRounds);

        // Mark debate as completed if it finished naturally
        if (user && debateId) {
          updateDebateStatus(supabase, debateId, "completed").catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function validateKeys(config: DebateConfig, keys: UserKeys): string[] {
  const needed = new Set<string>();

  for (const d of config.debaters) {
    needed.add(d.provider);
  }
  needed.add(config.judge.provider);

  const missing: string[] = [];
  for (const provider of needed) {
    const key = keys[provider as keyof UserKeys];
    if (!key?.trim()) {
      missing.push(provider);
    }
  }
  return missing;
}
