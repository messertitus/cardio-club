-- 072_landing_stats_weekly_cardiotage.sql
--
-- The landing should state how many Cardiotage there are PER WEEK (the club's
-- recurring schedule), not how many event rows happen to be open. Switches the
-- public RPC from `events_upcoming` to `weekly_cardiotage`, derived from the
-- configured event days (mcc_event_days). Redefines landing_public_stats().

create or replace function public.landing_public_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with venue_groups as (
    select
      coalesce(sp.venue_group_key, sp.id::text)               as grp,
      max(coalesce(nullif(trim(sp.location_name), ''), sp.name)) as name,
      avg(sp.latitude)                                         as lat,
      avg(sp.longitude)                                        as lng,
      array_agg(distinct s.name)                               as sports,
      array_agg(sp.id)                                         as profile_ids
    from public.sport_profiles sp
    join public.sports s on s.id = sp.sport_id
    where sp.is_active
      and sp.latitude is not null
      and sp.longitude is not null
    group by coalesce(sp.venue_group_key, sp.id::text)
  ),
  venues as (
    select
      vg.name,
      round(vg.lat::numeric, 5) as lat,
      round(vg.lng::numeric, 5) as lng,
      vg.sports,
      (
        select count(*)
        from public.event_activities ea
        where ea.sport_profile_id = any (vg.profile_ids)
      ) as sessions
    from venue_groups vg
  )
  select jsonb_build_object(
    'members',       (select count(*) - 1 from public.club_members),
    'sports_active', (select count(*) from public.sports where is_active),
    'weekly_cardiotage', (select count(*) from public.mcc_event_days),
    'sports', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', name, 'icon', icon_name)
        order by name
      )
      from public.sports
      where is_active
    ), '[]'::jsonb),
    'venues', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', name,
          'lat', lat,
          'lng', lng,
          'sports', to_jsonb(sports),
          'sessions', sessions
        )
        order by sessions desc, name
      )
      from venues
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.landing_public_stats() to anon, authenticated;
