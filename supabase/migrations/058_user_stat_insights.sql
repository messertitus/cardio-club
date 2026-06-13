-- 058: Derived statistics ("insights") — combinations computed at read time.
--
-- PHILOSOPHY: raw collection stays minimal and purpose-bound (056/057). The
-- richness that gamification needs — rates, streaks, diversity, time-of-day
-- rhythm, composite scores — is DERIVED on demand from the data already stored,
-- not duplicated into new columns. This is data minimisation done right: we add
-- read power, not storage.
--
-- The function reads ONLY the analytics tables (user_stat_counters,
-- user_activity_events). It performs no joins into votes/attendance/decisions,
-- so it cannot leak any algorithm internals — the vote-outcome inputs come from
-- the already-public result counters written in 057. Self for any user, any
-- target for admins (same gate as get_user_stats).

create or replace function public.get_user_stat_insights(target_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(target_user_id, auth.uid());
  v_tz text := 'Europe/Berlin';

  -- raw counter shortcuts
  v_sessions bigint;
  v_attended bigint;
  v_no_show bigint;
  v_att_set bigint;
  v_wish_won bigint;
  v_wish_partial bigint;
  v_wish_not bigint;
  v_vote_sub bigint;
  v_vote_changed bigint;
  v_ideas bigint;
  v_ideas_acc bigint;
  v_proposals bigint;
  v_profile bigint;
  v_chat bigint;
  v_invite_made bigint;
  v_invite_used bigint;
  v_direct bigint;

  -- derived
  v_active_days int;
  v_active_weeks int;
  v_streak int := 0;
  v_first timestamptz;
  v_last timestamptz;
  v_distinct_sports int;
  v_reviewed bigint;
  v_decided bigint;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if v_target <> auth.uid() and not public.is_admin_user(auth.uid()) then
    raise exception 'Not allowed to read other users statistics';
  end if;

  -- Pull the counters we combine (0 when absent).
  select
    coalesce(max(value) filter (where metric_key = 'app.session_started'), 0),
    coalesce(max(value) filter (where metric_key = 'attendance.attended'), 0),
    coalesce(max(value) filter (where metric_key = 'attendance.no_show'), 0),
    coalesce(max(value) filter (where metric_key = 'attendance.set'), 0),
    coalesce(max(value) filter (where metric_key = 'vote.wish_won'), 0),
    coalesce(max(value) filter (where metric_key = 'vote.wish_partial'), 0),
    coalesce(max(value) filter (where metric_key = 'vote.wish_not_met'), 0),
    coalesce(max(value) filter (where metric_key = 'vote.submitted'), 0),
    coalesce(max(value) filter (where metric_key = 'vote.changed'), 0),
    coalesce(max(value) filter (where metric_key = 'idea.suggested'), 0),
    coalesce(max(value) filter (where metric_key = 'idea.accepted'), 0),
    coalesce(max(value) filter (where metric_key = 'proposal.created'), 0),
    coalesce(max(value) filter (where metric_key = 'profile.updated'), 0),
    coalesce(max(value) filter (where metric_key = 'chat.message_sent'), 0),
    coalesce(max(value) filter (where metric_key = 'invite.created'), 0),
    coalesce(max(value) filter (where metric_key = 'invite.used'), 0),
    coalesce(max(value) filter (where metric_key = 'feature.direct_chat_started'), 0)
  into v_sessions, v_attended, v_no_show, v_att_set, v_wish_won, v_wish_partial, v_wish_not,
       v_vote_sub, v_vote_changed, v_ideas, v_ideas_acc, v_proposals, v_profile, v_chat,
       v_invite_made, v_invite_used, v_direct
  from public.user_stat_counters
  where user_id = v_target;

  -- Activity-log derived facts.
  select
    count(distinct (occurred_at at time zone v_tz)::date),
    count(distinct date_trunc('week', occurred_at at time zone v_tz)),
    min(occurred_at),
    max(occurred_at)
  into v_active_days, v_active_weeks, v_first, v_last
  from public.user_activity_events
  where user_id = v_target;

  -- Distinct sports the user voted for (diversity), from event context.
  select count(distinct context->>'sportId')
  into v_distinct_sports
  from public.user_activity_events
  where user_id = v_target
    and event_type in ('vote.submitted', 'vote.changed')
    and context ? 'sportId';

  -- Current weekly streak: consecutive ISO weeks with ≥1 activity, ending at
  -- the current week. Stops at the first gap; capped to stay bounded.
  while v_streak < 520 loop
    if exists (
      select 1 from public.user_activity_events
      where user_id = v_target
        and date_trunc('week', occurred_at at time zone v_tz)
            = date_trunc('week', (now() at time zone v_tz)) - make_interval(weeks => v_streak)
    ) then
      v_streak := v_streak + 1;
    else
      exit;
    end if;
  end loop;

  v_reviewed := v_attended + v_no_show;
  v_decided := v_wish_won + v_wish_partial + v_wish_not;

  v_result := jsonb_build_object(
    'userId', v_target,
    'firstActiveAt', v_first,
    'lastActiveAt', v_last,
    'daysSinceLastActive', case when v_last is null then null else greatest(0, (current_date - (v_last at time zone v_tz)::date)) end,
    'activeDays', coalesce(v_active_days, 0),
    'activeWeeks', coalesce(v_active_weeks, 0),
    'currentWeekStreak', v_streak,
    'distinctVotedSports', coalesce(v_distinct_sports, 0),
    -- Behavioural rhythm: when is this member active? (Berlin time.)
    'timeOfDay', jsonb_build_object(
      'morning',   (select count(*) from public.user_activity_events where user_id = v_target and extract(hour from occurred_at at time zone v_tz) between 5 and 11),
      'afternoon', (select count(*) from public.user_activity_events where user_id = v_target and extract(hour from occurred_at at time zone v_tz) between 12 and 17),
      'evening',   (select count(*) from public.user_activity_events where user_id = v_target and extract(hour from occurred_at at time zone v_tz) between 18 and 22),
      'night',     (select count(*) from public.user_activity_events where user_id = v_target and (extract(hour from occurred_at at time zone v_tz) >= 23 or extract(hour from occurred_at at time zone v_tz) <= 4))
    ),
    'weekday', (
      select coalesce(jsonb_object_agg(dow::text, cnt), '{}'::jsonb)
      from (
        select extract(isodow from occurred_at at time zone v_tz)::int as dow, count(*) as cnt
        from public.user_activity_events where user_id = v_target
        group by 1
      ) w
    ),
    -- Rates (percent, null when no basis yet).
    'rates', jsonb_build_object(
      'reliabilityPercent',         case when v_reviewed > 0 then round(v_attended::numeric * 100 / v_reviewed) else null end,
      'attendanceFollowThrough',    case when v_att_set > 0 then round(v_attended::numeric * 100 / v_att_set) else null end,
      'wishFulfilledPercent',       case when v_decided > 0 then round(v_wish_won::numeric * 100 / v_decided) else null end,
      'wishCoveredPercent',         case when v_decided > 0 then round((v_wish_won + v_wish_partial)::numeric * 100 / v_decided) else null end,
      'ideaAcceptancePercent',      case when v_ideas > 0 then round(v_ideas_acc::numeric * 100 / v_ideas) else null end,
      'voteRevisionPercent',        case when v_vote_sub > 0 then round(v_vote_changed::numeric * 100 / v_vote_sub) else null end
    ),
    -- Composite scores (transparent integer sums; tuning happens in later
    -- gamification work — these are a starting point, not shown to users yet).
    'scores', jsonb_build_object(
      'participation', (v_attended * 3 + v_att_set),
      'contribution',  (v_ideas * 2 + v_ideas_acc * 5 + v_proposals * 2 + v_profile),
      'social',        (v_chat + v_invite_made * 2 + v_invite_used * 5 + v_direct * 2),
      'engagement',    (v_sessions + coalesce(v_active_weeks, 0) * 3 + v_vote_sub)
    )
  );

  return v_result;
end;
$$;

grant execute on function public.get_user_stat_insights(uuid) to authenticated;

notify pgrst, 'reload schema';
