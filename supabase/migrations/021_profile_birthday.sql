alter table public.profiles
  add column if not exists birth_date date;

notify pgrst, 'reload schema';
