import { createSupabaseServer } from "@/lib/supabase/server";
import { getDebate, getDebateRounds } from "@/lib/db";
import { NextResponse } from "next/server";

/** GET /api/debates/[id] — get a debate with its rounds */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const debate = await getDebate(supabase, id);
    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    const rounds = await getDebateRounds(supabase, id);
    return NextResponse.json({ debate, rounds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
