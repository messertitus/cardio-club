-- 057: Server-side OUTCOME analytics (subject ≠ actor).
--
-- WHY: The client tracker in 056 records via record_user_metric(), which forces
-- user_id = auth.uid() — so it can only capture things the user does themselves.
-- Several gamification-relevant signals are caused by SOMEONE ELSE:
--   * "Event tatsächlich besucht" / "No-Show"  → set by an admin/AP review.
--   * "Vorschlag angenommen/abgelehnt"          → set by an admin.
--   * "Einladung genutzt"                       → caused by the invitee.
--   * "Club beigetreten"                        → happens at signup.
--   * "Wunsch gewonnen / teilweise / nicht"     → result of the weekly decision.
-- These are recorded here via SECURITY DEFINER triggers that write to the
-- analytics tables for the SUBJECT user. This is pure additive observation: it
-- does NOT change any decision/voting/fairness logic. The vote-outcome trigger
-- only compares each voter's recorded picks against the already-public result
-- fields (weekly_events.selected_sport_id / secondary_sport_id) — no algorithm
-- internals are read or exposed.

-- Internal recorder for an ARBITRARY target user. Not granted to clients; only
-- the SECURITY DEFINER triggers below call it. Mirrors record_user_metric's
-- upsert + optional activity event, with the same key-format guard.
create or replace function public._record_metric_for(
  p_user uuid,
  p_metric_key text,
  p_increment bigint default 1,
  p_event_type text default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;

  if p_metric_key is not null and public.is_valid_stat_key(p_metric_key) then
    insert into public.user_stat_counters (user_id, metric_key, value, last_event_at, updated_at)
    values (p_user, p_metric_key, coalesce(p_increment, 1), now(), now())
    on conflict (user_id, metric_key)
    do update set value = public.user_stat_counters.value + coalesce(p_increment, 1),
                  last_event_at = now(),
                  updated_at = now();
  end if;

  if p_event_type is not null and public.is_valid_stat_key(p_event_type)
     and pg_column_size(coalesce(p_context, '{}'::jsonb)) <= 2048 then
    insert into public.user_activity_events (user_id, event_type, context)
    values (p_user, p_event_type, coalesce(p_context, '{}'::jsonb));
  end if;
end;
$$;

-- 0) RSVP set vs. changed + going/maybe/not_going history. Done server-side
--    because the client upsert cannot tell an insert (set) from an update
--    (changed). Subject = the row's user_id.
create or replace function public.track_attendance_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_key text := 'attendance.' || new.status::text; -- attendance.going|maybe|not_going
begin
  if tg_op = 'INSERT' then
    perform public._record_metric_for(new.user_id, 'attendance.set', 1, 'attendance.set',
      jsonb_build_object('eventId', new.event_id, 'status', new.status));
    perform public._record_metric_for(new.user_id, v_status_key, 1, null, null);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public._record_metric_for(new.user_id, 'attendance.changed', 1, 'attendance.changed',
      jsonb_build_object('eventId', new.event_id, 'status', new.status));
    perform public._record_metric_for(new.user_id, v_status_key, 1, null, null);
  end if;
  return new;
end;
$$;

drop trigger if exists track_attendance_rsvp_insert on public.attendance;
create trigger track_attendance_rsvp_insert
after insert on public.attendance
for each row execute function public.track_attendance_rsvp();

drop trigger if exists track_attendance_rsvp_update on public.attendance;
create trigger track_attendance_rsvp_update
after update of status on public.attendance
for each row execute function public.track_attendance_rsvp();

-- 1) Actual attendance review → present (attended) / absent (no-show).
create or replace function public.track_attendance_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actual_status is distinct from old.actual_status then
    if new.actual_status = 'present'::public.actual_attendance_status then
      perform public._record_metric_for(new.user_id, 'attendance.attended', 1, 'attendance.attended',
        jsonb_build_object('eventId', new.event_id));
    elsif new.actual_status = 'absent'::public.actual_attendance_status then
      perform public._record_metric_for(new.user_id, 'attendance.no_show', 1, 'attendance.no_show',
        jsonb_build_object('eventId', new.event_id));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists track_attendance_outcome_trigger on public.attendance;
create trigger track_attendance_outcome_trigger
after update of actual_status on public.attendance
for each row execute function public.track_attendance_outcome();

-- 2) Sport idea reviewed → accepted / rejected, credited to the suggester.
create or replace function public.track_sport_idea_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public._record_metric_for(new.suggested_by, 'idea.accepted', 1, 'idea.accepted',
        jsonb_build_object('ideaId', new.id));
    elsif new.status = 'rejected' then
      perform public._record_metric_for(new.suggested_by, 'idea.rejected', 1, 'idea.rejected',
        jsonb_build_object('ideaId', new.id));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists track_sport_idea_outcome_trigger on public.sport_ideas;
create trigger track_sport_idea_outcome_trigger
after update of status on public.sport_ideas
for each row execute function public.track_sport_idea_outcome();

-- 3) Invitation consumed → credit the inviter ("Einladung genutzt").
create or replace function public.track_invitation_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.used_by is null and new.used_by is not null then
    perform public._record_metric_for(new.created_by, 'invite.used', 1, 'invite.used',
      jsonb_build_object('codeId', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists track_invitation_used_trigger on public.invitation_codes;
create trigger track_invitation_used_trigger
after update of used_by on public.invitation_codes
for each row execute function public.track_invitation_used();

-- 4) Club membership created → "Club beigetreten" for the new member.
create or replace function public.track_club_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._record_metric_for(new.user_id, 'club.joined', 1, 'club.joined',
    jsonb_build_object('clubId', new.club_id));
  return new;
end;
$$;

drop trigger if exists track_club_joined_trigger on public.club_members;
create trigger track_club_joined_trigger
after insert on public.club_members
for each row execute function public.track_club_joined();

-- 5) Weekly decision finalized → per voter, was their wish met?
--    RESULT data only: compares each voter's recorded picks to the public
--    selected/secondary sport. No algorithm internals are read or revealed.
--      * wish_won     : their rank-1 sport is among the decided sports.
--      * wish_partial : another of their picks (rank 2/3) is decided.
--      * wish_not_met : none of their picks is decided.
create or replace function public.track_vote_outcomes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decided uuid[];
  r record;
begin
  if new.status = 'decided'::public.weekly_event_status
     and old.status is distinct from new.status then
    v_decided := array_remove(array[new.selected_sport_id, new.secondary_sport_id], null);
    if array_length(v_decided, 1) is null then
      return new;
    end if;

    for r in
      select v.user_id,
             bool_or(v.vote_rank = 1 and v.sport_id = any(v_decided)) as rank1_won,
             bool_or(v.sport_id = any(v_decided)) as any_won
      from public.sport_votes v
      where v.event_id = new.id
      group by v.user_id
    loop
      if r.rank1_won then
        perform public._record_metric_for(r.user_id, 'vote.wish_won', 1, 'vote.wish_won',
          jsonb_build_object('eventId', new.id));
      elsif r.any_won then
        perform public._record_metric_for(r.user_id, 'vote.wish_partial', 1, 'vote.wish_partial',
          jsonb_build_object('eventId', new.id));
      else
        perform public._record_metric_for(r.user_id, 'vote.wish_not_met', 1, 'vote.wish_not_met',
          jsonb_build_object('eventId', new.id));
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists track_vote_outcomes_trigger on public.weekly_events;
create trigger track_vote_outcomes_trigger
after update of status on public.weekly_events
for each row execute function public.track_vote_outcomes();

notify pgrst, 'reload schema';
