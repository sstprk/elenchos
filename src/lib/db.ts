/**
 * Database operations for debates — used from server-side code.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DebateConfig, Round } from "@/lib/types";

export interface DbDebate {
  id: string;
  user_id: string;
  topic: string;
  config: DebateConfig;
  status: "in_progress" | "completed" | "stopped";
  total_rounds: number;
  final_convergence_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbRound {
  id: string;
  debate_id: string;
  round_number: number;
  debater_responses: Round["debaterResponses"];
  judge_evaluation: Round["judgeEvaluation"];
  created_at: string;
}

/** Create a new debate session and return its ID. */
export async function createDebate(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
  config: DebateConfig
): Promise<string> {
  const { data, error } = await supabase
    .from("debates")
    .insert({
      user_id: userId,
      topic,
      config,
      status: "in_progress",
      total_rounds: 0,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create debate: ${error.message}`);
  return data.id;
}

/** Save a completed round to the database. */
export async function saveRound(
  supabase: SupabaseClient,
  debateId: string,
  round: Round
): Promise<void> {
  const { error } = await supabase.from("rounds").insert({
    debate_id: debateId,
    round_number: round.roundNumber,
    debater_responses: round.debaterResponses,
    judge_evaluation: round.judgeEvaluation,
  });

  if (error) throw new Error(`Failed to save round: ${error.message}`);

  // Update debate total_rounds and convergence
  await supabase
    .from("debates")
    .update({
      total_rounds: round.roundNumber,
      final_convergence_score: round.judgeEvaluation.convergenceScore,
    })
    .eq("id", debateId);
}

/** Mark a debate as completed or stopped. */
export async function updateDebateStatus(
  supabase: SupabaseClient,
  debateId: string,
  status: "completed" | "stopped"
): Promise<void> {
  const { error } = await supabase
    .from("debates")
    .update({ status })
    .eq("id", debateId);

  if (error) throw new Error(`Failed to update debate status: ${error.message}`);
}

/** List all debates for a user, newest first. */
export async function listDebates(
  supabase: SupabaseClient,
  userId: string
): Promise<DbDebate[]> {
  const { data, error } = await supabase
    .from("debates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list debates: ${error.message}`);
  return data as DbDebate[];
}

/** Get a single debate by ID (with ownership check via RLS). */
export async function getDebate(
  supabase: SupabaseClient,
  debateId: string
): Promise<DbDebate | null> {
  const { data, error } = await supabase
    .from("debates")
    .select("*")
    .eq("id", debateId)
    .single();

  if (error) return null;
  return data as DbDebate;
}

/** Get all rounds for a debate, ordered by round number. */
export async function getDebateRounds(
  supabase: SupabaseClient,
  debateId: string
): Promise<Round[]> {
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("debate_id", debateId)
    .order("round_number", { ascending: true });

  if (error) throw new Error(`Failed to get rounds: ${error.message}`);

  return (data as DbRound[]).map((r) => ({
    roundNumber: r.round_number,
    debaterResponses: r.debater_responses,
    judgeEvaluation: r.judge_evaluation,
  }));
}

/** Delete a debate and all its rounds (cascade). */
export async function deleteDebate(
  supabase: SupabaseClient,
  debateId: string
): Promise<void> {
  const { error } = await supabase
    .from("debates")
    .delete()
    .eq("id", debateId);

  if (error) throw new Error(`Failed to delete debate: ${error.message}`);
}
