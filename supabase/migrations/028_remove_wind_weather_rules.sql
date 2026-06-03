update public.sport_profiles
set weather_rules = coalesce(weather_rules, '{}'::jsonb) - 'windSensitive' - 'maxWindKmh'
where weather_rules ? 'windSensitive'
   or weather_rules ? 'maxWindKmh';

update public.sport_ideas
set weather_rules = coalesce(weather_rules, '{}'::jsonb) - 'windSensitive' - 'maxWindKmh'
where weather_rules ? 'windSensitive'
   or weather_rules ? 'maxWindKmh';

notify pgrst, 'reload schema';
