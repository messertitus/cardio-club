alter table public.sport_ideas
  add column if not exists sport_ids uuid[] not null default '{}'::uuid[];

update public.sport_ideas
set sport_ids = array[sport_id]::uuid[]
where sport_id is not null
  and coalesce(array_length(sport_ids, 1), 0) = 0;

notify pgrst, 'reload schema';
