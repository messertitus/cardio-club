create table if not exists public.event_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.weekly_events (id) on delete cascade,
  activity_id uuid references public.event_activities (id) on delete set null,
  sport_id uuid references public.sports (id) on delete set null,
  result_type text not null default 'summary' check (result_type in ('summary', 'score', 'ranking')),
  summary text not null check (char_length(trim(summary)) between 1 and 1000),
  scores jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_results_event_idx
on public.event_results (event_id, created_at desc);

alter table public.event_results enable row level security;

drop policy if exists "event results visible to event members" on public.event_results;
create policy "event results visible to event members"
on public.event_results for select
to authenticated
using (public.is_club_member(public.event_club_id(event_id)));

drop policy if exists "event results managed by event members" on public.event_results;
create policy "event results managed by event members"
on public.event_results for all
to authenticated
using (public.is_club_member(public.event_club_id(event_id)))
with check (public.is_club_member(public.event_club_id(event_id)));

notify pgrst, 'reload schema';
