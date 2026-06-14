-- Allow club admins to update any sport.
--
-- The only UPDATE policy on public.sports was "sports can be updated by creator"
-- (using created_by = auth.uid()). Sport mutations from the admin tools go through
-- the security-definer RPC admin_upsert_sport for the core fields, but a couple of
-- follow-up writes happen client-side and are therefore subject to RLS:
--   * upsertMccSport() updates icon_name after the RPC, and
--   * setMccSportActive() flips is_active when reactivating a sport.
-- When the sport was created by someone else (or seeded with a null created_by),
-- RLS filtered the row out, the ".select().single()" returned zero rows, and the
-- admin saw "Cannot coerce the result to a single JSON object" while approving an
-- idea that reused an existing abstract sport.
--
-- Postgres combines permissive policies with OR, so this simply grants admins the
-- update capability in addition to the existing creator rule.

drop policy if exists "sports can be updated by admins" on public.sports;
create policy "sports can be updated by admins"
on public.sports for update
to authenticated
using (public.is_current_mcc_admin())
with check (public.is_current_mcc_admin());
