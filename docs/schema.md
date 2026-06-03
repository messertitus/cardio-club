# Messers Cardio Club Database Schema

This schema models the current Messers Cardio Club app as one bootstrapped club with weekly sports events. The `clubs` tables still act as the internal membership and RLS scope, even though the product flow currently exposes only the single MCC club. It is designed for Supabase/PostgreSQL with Row Level Security enabled on every application table.

## Main Tables

- `profiles`: Public app profile for each Supabase auth user. Users can create and update only their own profile.
- `clubs`: Internal club scope for MCC membership, weekly events, chat, and RLS. The current app bootstraps one MCC club instead of offering a broad multi-club product.
- `club_members`: Membership and role assignment for a club. Active product roles are `admin`, `mod`, and `member`; older migrations may still contain the original `owner` enum value.
- `sports`: Shared abstract sport catalog. A sport represents the activity family, such as Beachvolleyball or Cycling, not a concrete venue.
- `sport_profiles`: Concrete sport variants with venue, coordinates, location type, weather rules, group-size limits, equipment, practical notes, and AP requirements.
- `weekly_events`: One planned club event per week. Stores compatibility selected/secondary sports, decision type, scorecard, weather snapshot, event status, time, location, notes, and decision reason.
- `sport_proposals`: Candidate sports proposed for a weekly event.
- `sport_votes`: Member votes for proposed sports. Each member can vote for up to three sports per event using ranked choices: first choice `1.0`, second choice `0.6`, third choice `0.3`.
- `sport_no_gos`: Optional personal exclusions for proposed sports. No-Go is not downvoting; it marks a sport as not acceptable for that member.
- `attendance`: RSVP state for event participants. Members can join the primary event or an optional subgroup. Actual attendance can be reviewed after the event by an admin/AP through `review_event_attendance`.
- `event_activities`: Final persisted activity rows for Single, Multi-Sport, and Twin decisions, including concrete sport profile and assigned users.
- `event_subgroups`: Backward-compatible split-group handling for Twin decisions.
- `member_preference_history`: Per-week preference facts used by the fairness algorithm to detect repeatedly ignored minority preferences.

## Important Constraints

- `weekly_events` has a unique `(club_id, week_start_date)` constraint to prevent duplicate weekly events.
- `club_members` has a unique `(club_id, user_id)` constraint.
- `sport_proposals` has a unique `(event_id, sport_id)` constraint so each sport appears once per event.
- `sport_votes` references `(event_id, sport_id)` on `sport_proposals`, so members can vote only on proposed sports.
- `sport_votes` has unique `(event_id, sport_id, user_id)` and `(event_id, user_id, vote_rank)` constraints, preventing duplicate sport votes and duplicate ranks.
- `sport_no_gos` has unique `(event_id, sport_id, user_id)` and also references proposed sports.
- A trigger prevents more than three votes per member/event, closes vote writes once an event is no longer `proposing` or `voting`, and requires a `going` or `maybe` attendance row before voting.
- `attendance` has a unique `(event_id, user_id)` constraint.
- `weekly_events.secondary_sport_id` must be different from `selected_sport_id` when present.
- `event_activities` stores the concrete `sport_profile_id`; `weekly_events.selected_sport_id` and `secondary_sport_id` remain compatibility fields for the first two activities.
- `attendance.subgroup_id`, when present, must point to a subgroup from the same event via RLS write checks.

## Row Level Security

All tables have RLS enabled. Policies use helper functions:

- `is_club_member(club_id)`: true when the authenticated user belongs to the club.
- `is_club_admin(club_id)`: true when the authenticated user is an `owner` or `admin`.
- `event_club_id(event_id)`: resolves an event to its club.
- `subgroup_event_id(subgroup_id)`: resolves a subgroup to its event.

Authenticated club members can read club-scoped data for their clubs. Club admins can manage clubs, events, membership, subgroups, and administrative preference history. Regular members can propose sports, vote after setting `going`/`maybe`, and manage their own planned attendance.

Actual attendance review is intentionally separate from RSVP updates. `review_event_attendance` can be executed by club admins, the event activity contact, or the activity AP/contact assigned in `event_activities`, as long as the reviewer is also marked `going` or `maybe` for that event.

Admins can finalize weekly decisions through `weekly_events` updates and `event_activities` writes. Once finalized with status `decided`, voting policies and triggers block new vote inserts, updates, deletes, and No-Go changes.

## Fairness Support

The Fairness-First Constellation algorithm should use `sport_votes`, `sport_no_gos`, `sport_profiles`, `attendance`, `weekly_events`, and `member_preference_history` together:

- Ignore `not_going` and missing attendance, count `maybe` weaker than `going`, and never penalize honest non-participation.
- Treat votes as abstract sport preferences, then choose concrete `sport_profiles`.
- Treat No-Go as personal non-acceptance, separate from ranked voting.
- Apply weather and safety rules to profiles; dangerous weather excludes profiles, poor weather penalizes them.
- Score Single, Multi-Sport, and Twin candidates across participation, preference, fairness, minority protection, togetherness, weather, practicality, rotation, and reliability.
- Persist the chosen constellation in `event_activities` and mirror the first two sports into `weekly_events`.
