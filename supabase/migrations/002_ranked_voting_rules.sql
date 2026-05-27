alter table public.sport_votes
  add column if not exists vote_rank integer;

update public.sport_votes
set vote_rank = 1
where vote_rank is null;

alter table public.sport_votes
  drop constraint if exists sport_votes_weight_check;

alter table public.sport_votes
  alter column vote_rank set not null,
  alter column weight type numeric(2, 1) using weight::numeric(2, 1),
  alter column weight set default 1.0;

do $$
begin
  alter table public.sport_votes
    add constraint sport_votes_vote_rank_check check (vote_rank between 1 and 3);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.sport_votes
    add constraint sport_votes_rank_weight_check check (
      (vote_rank = 1 and weight = 1.0)
      or (vote_rank = 2 and weight = 0.6)
      or (vote_rank = 3 and weight = 0.3)
    );
exception
  when duplicate_object then null;
end $$;

create unique index if not exists sport_votes_event_user_rank_idx
  on public.sport_votes (event_id, user_id, vote_rank);

create or replace function public.weekly_event_is_open_for_voting(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.weekly_events we
    where we.id = target_event_id
      and we.status in ('proposing', 'voting')
  );
$$;

create or replace function public.enforce_sport_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_vote_count integer;
begin
  if not public.weekly_event_is_open_for_voting(new.event_id) then
    raise exception 'Voting is closed for finalized events.';
  end if;

  select count(*)
  into existing_vote_count
  from public.sport_votes sv
  where sv.event_id = new.event_id
    and sv.user_id = new.user_id
    and (tg_op = 'INSERT' or sv.id <> new.id);

  if existing_vote_count >= 3 then
    raise exception 'A member can vote for at most three sports per event.';
  end if;

  new.weight := case new.vote_rank
    when 1 then 1.0
    when 2 then 0.6
    when 3 then 0.3
  end;

  return new;
end;
$$;

drop trigger if exists enforce_sport_vote_rules_trigger on public.sport_votes;
create trigger enforce_sport_vote_rules_trigger
before insert or update on public.sport_votes
for each row execute function public.enforce_sport_vote_rules();

drop policy if exists "sport votes can be created by event club members" on public.sport_votes;
create policy "sport votes can be created by event club members"
on public.sport_votes for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
  and public.weekly_event_is_open_for_voting(event_id)
);

drop policy if exists "sport votes can be updated by voter" on public.sport_votes;
create policy "sport votes can be updated by voter"
on public.sport_votes for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
  and public.weekly_event_is_open_for_voting(event_id)
);

drop policy if exists "sport votes can be deleted by voter or club admins" on public.sport_votes;
create policy "sport votes can be deleted by voter or club admins"
on public.sport_votes for delete
to authenticated
using (
  public.weekly_event_is_open_for_voting(event_id)
  and (
    user_id = auth.uid()
    or public.is_club_admin(public.event_club_id(event_id))
  )
);
