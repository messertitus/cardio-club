alter table public.sport_profiles
  add column if not exists location_rules text,
  add column if not exists ap_contact_id uuid references public.profiles (id) on delete set null;

create index if not exists sport_profiles_ap_contact_idx
on public.sport_profiles (ap_contact_id);

notify pgrst, 'reload schema';
