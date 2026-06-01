alter table public.profiles
  add column if not exists postal_code text,
  add column if not exists city text;

create index if not exists profiles_city_idx on public.profiles (city);

alter type public.club_member_role add value if not exists 'mod';
