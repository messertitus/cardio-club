alter table public.weekly_events
  add column if not exists decision_character text,
  add column if not exists decision_explainability jsonb,
  add column if not exists losing_candidate_reasons jsonb,
  add column if not exists no_go_breakdown jsonb;

alter table public.sport_profiles
  add column if not exists ap_requirement_level text not null default 'none',
  add column if not exists cost_required boolean not null default false,
  add column if not exists cost_per_person numeric,
  add column if not exists cost_currency text not null default 'EUR',
  add column if not exists minimum_participants integer,
  add column if not exists maximum_participants integer;

alter table public.sport_profiles
  drop constraint if exists sport_profiles_ap_requirement_level_check;

alter table public.sport_profiles
  add constraint sport_profiles_ap_requirement_level_check
  check (ap_requirement_level in ('none', 'required', 'critical'));

alter table public.sport_profiles
  drop constraint if exists sport_profiles_minimum_participants_check;

alter table public.sport_profiles
  add constraint sport_profiles_minimum_participants_check
  check (minimum_participants is null or minimum_participants >= 1);

alter table public.sport_profiles
  drop constraint if exists sport_profiles_maximum_participants_check;

alter table public.sport_profiles
  add constraint sport_profiles_maximum_participants_check
  check (
    maximum_participants is null
    or (
      maximum_participants >= 1
      and (
        minimum_participants is null
        or maximum_participants >= minimum_participants
      )
    )
  );

alter table public.sport_profiles
  drop constraint if exists sport_profiles_cost_currency_check;

alter table public.sport_profiles
  add constraint sport_profiles_cost_currency_check
  check (char_length(trim(cost_currency)) between 3 and 8);

update public.sport_profiles
set
  ap_requirement_level = case
    when ap_requirement_level in ('none', 'required', 'critical') then ap_requirement_level
    when ap_required then 'required'
    else 'none'
  end,
  minimum_participants = coalesce(minimum_participants, minimum_group_size),
  maximum_participants = coalesce(maximum_participants, maximum_group_size),
  cost_required = coalesce(cost_required, cost_note is not null),
  cost_currency = coalesce(nullif(trim(cost_currency), ''), 'EUR');

notify pgrst, 'reload schema';
