update public.profiles
set phone = '+' || phone
where phone is not null
  and phone <> ''
  and phone !~ '^\+'
  and phone ~ '^[1-9][0-9]{7,14}$';

notify pgrst, 'reload schema';
