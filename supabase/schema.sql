-- DrawGeo cloud schema (Supabase / Postgres).
-- Enable Google and Email (magic link) providers in Supabase Auth, then run this.

create table if not exists public.constructions (
  id          text primary key,
  owner       uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'Untitled construction',
  doc         jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists constructions_owner_updated on public.constructions (owner, updated_at desc);

alter table public.constructions enable row level security;

-- Each user can only see and change their own constructions.
create policy "own rows: select" on public.constructions for select using (auth.uid() = owner);
create policy "own rows: insert" on public.constructions for insert with check (auth.uid() = owner);
create policy "own rows: update" on public.constructions for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "own rows: delete" on public.constructions for delete using (auth.uid() = owner);
