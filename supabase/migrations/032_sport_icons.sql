alter table public.sports
  add column if not exists icon_name text;

comment on column public.sports.icon_name is 'Optional MaterialCommunityIcons name used for app sport badges.';
