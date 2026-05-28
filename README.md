# Messers Cardio Club

MVP for a private weekly cardio club. The current web build uses Expo Router and Supabase.

## Current Flow

- The welcome screen asks for an invitation code first.
- After a valid code, registration asks for name, e-mail, and a personal PIN.
- Existing users can log in with e-mail and PIN.
- Initial admin: `messertitus@outlook.com`.
- Admins can create unlimited invite codes.
- Members can create 3 invite codes total.
- After login, the app opens directly on the next event.

## Setup

Install dependencies:

```powershell
npm.cmd install
```

Create `.env` from `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Run the Supabase SQL migrations in order:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_ranked_voting_rules.sql
supabase/migrations/003_invite_pin_auth.sql
supabase/migrations/004_refresh_profile_auth_schema.sql
supabase/migrations/005_fix_profiles_rls_recursion.sql
supabase/migrations/006_live_test_phase_app_data.sql
supabase/migrations/007_fix_mcc_bootstrap_ambiguity.sql
supabase/migrations/009_clean_email_display_names.sql
supabase/migrations/010_fix_invites_and_titus_name.sql
supabase/migrations/011_fix_invite_random_bytes.sql
supabase/migrations/012_phone_auth_invite_usage_and_ideas.sql
supabase/migrations/013_admin_invite_role.sql
```

If Supabase shows `Could not find the 'email' column of 'profiles' in the schema cache`, run migration `003` and then `004` again in the SQL editor. The fourth migration also sends a PostgREST schema reload notification.
If Supabase shows `infinite recursion detected in policy for relation "profiles"`, run migration `005`.

Migration `006` switches the app into live test mode:

- Seeds the real sport catalog.
- Creates the current MCC week on first load.
- Stores attendance, votes, sport ideas, chat messages, and push subscriptions in Supabase.
- Starts with an empty chat and no dummy members.

If Supabase shows `column reference "club_id" is ambiguous`, run migration `007`.
If member names show as e-mail addresses, run migration `009`.
If creating invitation codes shows `function gen_random_bytes(integer) does not exist`, run migration `011`.
Migration `012` switches new accounts to phone-first auth, adds profile phone numbers, long numeric invite codes, sport idea location/time fields, and an admin-only `clear_mcc_test_data()` reset helper.
Migration `013` lets a single-use invite grant admin rights. This is used for a clean phone-first restart.

For SMS login, enable Phone Auth in Supabase Authentication and configure an SMS provider. Then new users register with invitation PIN, name, phone number, and personal PIN.

To clear the current MCC test data as an admin, run:

```sql
select public.clear_mcc_test_data();
```

For a full clean phone-auth restart, run:

```sql
supabase/maintenance/reset_for_phone_test.sql
```

The script prints one `admin_invite_pin`. Use that code for your first registration.

## Weekly Decision And Push

The app shows a live decision preview. For an automatic Wednesday final decision plus web push sending, see `docs/notifications-and-weekly-decision.md`.

For the easiest test phase, disable e-mail confirmation in Supabase Auth while testing:

```text
Authentication -> Providers -> Email -> Confirm email = off
```

## Development

```powershell
npm.cmd run web
```

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
```

## Static Web Export

```powershell
npm.cmd run export:web
```

The static output is written to `dist/`.

## Deploy On Ubuntu/VServer

Install Node.js 24 LTS or compatible, then:

```bash
npm install
npm run export:web
sudo mkdir -p /var/www/cardioclub
sudo cp -r dist/* /var/www/cardioclub/
```

Serve `/var/www/cardioclub` with nginx.

For the production-style test deployment with nginx, HTTPS, domain settings, and security headers, see `docs/deployment-ubuntu.md`.
