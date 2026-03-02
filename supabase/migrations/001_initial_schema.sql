-- Elenchus Database Schema
-- Run this in Supabase SQL Editor to set up the database.

-- ══════════════════════════════════════════════════════════════════════════════
-- Enable RLS (Row Level Security) on all tables
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Stores display names for auth users. Auto-created via trigger on signup.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── Debates ──────────────────────────────────────────────────────────────────
-- Each row is a saved debate session.
create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  config jsonb not null,            -- DebateConfig snapshot
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'stopped')),
  total_rounds integer not null default 0,
  final_convergence_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.debates enable row level security;

create policy "Users can read own debates"
  on public.debates for select
  using (auth.uid() = user_id);

create policy "Users can insert own debates"
  on public.debates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own debates"
  on public.debates for update
  using (auth.uid() = user_id);

create policy "Users can delete own debates"
  on public.debates for delete
  using (auth.uid() = user_id);

create index idx_debates_user_id on public.debates(user_id);
create index idx_debates_created_at on public.debates(created_at desc);


-- ── Rounds ───────────────────────────────────────────────────────────────────
-- Each round within a debate, storing full debater responses + judge evaluation.
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  round_number integer not null,
  debater_responses jsonb not null,  -- DebaterResponse[]
  judge_evaluation jsonb not null,   -- JudgeEvaluation
  created_at timestamptz not null default now(),

  unique(debate_id, round_number)
);

alter table public.rounds enable row level security;

create policy "Users can read rounds of own debates"
  on public.rounds for select
  using (
    exists (
      select 1 from public.debates
      where debates.id = rounds.debate_id
        and debates.user_id = auth.uid()
    )
  );

create policy "Users can insert rounds to own debates"
  on public.rounds for insert
  with check (
    exists (
      select 1 from public.debates
      where debates.id = rounds.debate_id
        and debates.user_id = auth.uid()
    )
  );

create policy "Users can delete rounds of own debates"
  on public.rounds for delete
  using (
    exists (
      select 1 from public.debates
      where debates.id = rounds.debate_id
        and debates.user_id = auth.uid()
    )
  );

create index idx_rounds_debate_id on public.rounds(debate_id);


-- ── Updated-at trigger ───────────────────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger set_updated_at
  before update on public.debates
  for each row execute function public.update_updated_at();
