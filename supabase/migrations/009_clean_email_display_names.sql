update public.profiles
set display_name = 'Mitglied'
where display_name like '%@%';

notify pgrst, 'reload schema';
