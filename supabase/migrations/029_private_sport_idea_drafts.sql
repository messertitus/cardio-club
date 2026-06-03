drop policy if exists "sport ideas are visible to authenticated users" on public.sport_ideas;
create policy "sport ideas are visible to authenticated users"
on public.sport_ideas for select
to authenticated
using (
  is_draft = false
  or suggested_by = auth.uid()
  or public.is_current_mcc_admin()
);

notify pgrst, 'reload schema';
