-- Make same-venue profiles group together for the decision algorithm.
--
-- The decision groups sport profiles into one "venue" (so several sports can run
-- together at the same place) when they share venue_group_key. That key is
-- derived from the location name (e.g. "Strandbad Horn" -> "strandbad-horn", see
-- deriveVenueGroupKey in src/services/sportProfiles.ts). Profiles created at the
-- same venue therefore group automatically — UNLESS their venue_group_key is
-- null (older rows) or the names differ slightly.
--
-- Run in the Supabase SQL editor.

-- 1) Inspect: how does each profile's venue group key look right now?
--    Profiles you consider "the same place" must end up with the SAME key.
select
  id,
  name,
  location_name,
  location_city,
  venue_group_key
from public.sport_profiles
order by coalesce(venue_group_key, ''), location_name;

-- 2) Safe backfill: only fill MISSING keys from the location name (never
--    overwrites a key an admin set on purpose). Mirrors deriveVenueGroupKey:
--    lowercase, drop accents/punctuation, collapse to single dashes, trim.
update public.sport_profiles
set venue_group_key = nullif(
  regexp_replace(
    regexp_replace(lower(trim(coalesce(location_name, location_city, ''))), '[^a-z0-9]+', '-', 'g'),
    '^-+|-+$', '', 'g'
  ),
  ''
)
where venue_group_key is null
  and coalesce(location_name, location_city) is not null;

-- 3) Optional — force one shared key for a specific venue, e.g. all the
--    "Strandbad Horn" profiles, so they group even if the names drift.
--    Edit the LIKE pattern and key, then run.
-- update public.sport_profiles
-- set venue_group_key = 'strandbad-horn'
-- where location_name ilike '%strandbad horn%';
