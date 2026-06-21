-- 068_public_landing_stats.sql
--
-- Public, PII-free data source for the marketing landing page
-- (messers-cardio-club.com). The landing build fetches this RPC anonymously.
--
-- All application tables have RLS that only club members can read, so the
-- landing (anonymous) cannot read them directly. This SECURITY DEFINER function
-- is the *only* sanctioned public surface and exposes strictly aggregate /
-- non-personal information:
--   - members        : headcount only (a single integer, no names/contacts)
--   - sports_active  : number of active sports in the catalog
--   - venues[]       : active sport venues that have coordinates, grouped by
--                      physical location (venue_group_key), with the sports
--                      offered there and how many finalized sessions happened.
--
-- No profile, attendance, vote, chat or invitation data is exposed.

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
    'members',       (select count(*) from public.club_members),
    'sports_active', (select count(*) from public.sports where is_active),
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

comment on function public.landing_public_stats() is
  'PII-free aggregate stats for the public landing page. Safe for anonymous access.';

grant execute on function public.landing_public_stats() to anon, authenticated;
