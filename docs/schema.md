# Messers Cardio Club Database Schema

This schema models clubs that meet for weekly cardio or sports events. It is designed for Supabase/PostgreSQL with Row Level Security enabled on every application table.

## Main Tables

- `profiles`: Public app profile for each Supabase auth user. Users can create and update only their own profile.
- `clubs`: A cardio club or group. Clubs are visible only to their members or the user who created the club.
- `club_members`: Membership and role assignment for a club. Roles are `owner`, `admin`, and `member`.
- `sports`: Shared sport catalog. Each sport has a category, intensity level, location type, and optional combinable tags.
- `weekly_events`: One planned club event per week. Stores selected and optional secondary sports, event status, time, location, notes, and decision reason.
- `sport_proposals`: Candidate sports proposed for a weekly event.
- `sport_votes`: Member votes for proposed sports. Each member can vote for up to three sports per event using ranked choices: first choice `1.0`, second choice `0.6`, third choice `0.3`.
- `attendance`: RSVP state for event participants. Members can join the primary event or an optional subgroup.
- `event_subgroups`: Optional split-group handling for cases where the club chooses multiple compatible activities.
- `member_preference_history`: Per-week preference facts used by the fairness algorithm to detect repeatedly ignored minority preferences.

## Important Constraints

- `weekly_events` has a unique `(club_id, week_start_date)` constraint to prevent duplicate weekly events.
- `club_members` has a unique `(club_id, user_id)` constraint.
- `sport_proposals` has a unique `(event_id, sport_id)` constraint so each sport appears once per event.
- `sport_votes` references `(event_id, sport_id)` on `sport_proposals`, so members can vote only on proposed sports.
- `sport_votes` has unique `(event_id, sport_id, user_id)` and `(event_id, user_id, vote_rank)` constraints, preventing duplicate sport votes and duplicate ranks.
- A trigger prevents more than three votes per member/event and closes vote writes once an event is no longer `proposing` or `voting`.
- `attendance` has a unique `(event_id, user_id)` constraint.
- `weekly_events.secondary_sport_id` must be different from `selected_sport_id` when present.
- `attendance.subgroup_id`, when present, must point to a subgroup from the same event via RLS write checks.

## Row Level Security

All tables have RLS enabled. Policies use helper functions:

- `is_club_member(club_id)`: true when the authenticated user belongs to the club.
- `is_club_admin(club_id)`: true when the authenticated user is an `owner` or `admin`.
- `event_club_id(event_id)`: resolves an event to its club.
- `subgroup_event_id(subgroup_id)`: resolves a subgroup to its event.

Authenticated club members can read club-scoped data for their clubs. Club admins can manage clubs, events, membership, subgroups, and administrative preference history. Regular members can propose sports, vote, and manage their own attendance.

Admins can finalize weekly decisions through `weekly_events` updates. Once finalized with status `decided`, voting policies and triggers block new vote inserts, updates, and deletes.

## Fairness Support

The selection algorithm should use `sport_votes`, `weekly_events`, and `member_preference_history` together:

- Exclude the previous week's `selected_sport_id`.
- Prefer the majority vote by default.
- Use `member_preference_history` to boost sports supported by members whose preferences have not been selected recently.
- Use `secondary_sport_id` and `event_subgroups` when split-group handling is appropriate.
