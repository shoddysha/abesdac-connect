-- Enable RLS on ministry_budgets table
alter table public.ministry_budgets enable row level security;

-- Drop existing policies if any
drop policy if exists "ministry_budgets_select_all" on public.ministry_budgets;
drop policy if exists "ministry_budgets_select_admin_secretary" on public.ministry_budgets;
drop policy if exists "ministry_budgets_select_leader" on public.ministry_budgets;
drop policy if exists "ministry_budgets_insert_leader" on public.ministry_budgets;
drop policy if exists "ministry_budgets_update_leader" on public.ministry_budgets;
drop policy if exists "ministry_budgets_update_admin_secretary" on public.ministry_budgets;
drop policy if exists "ministry_budgets_delete_all" on public.ministry_budgets;

-- SELECT: Admin and Secretary can see ALL budgets
create policy "ministry_budgets_select_admin_secretary"
  on public.ministry_budgets
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrator', 'secretary')
      and profiles.is_active = true
    )
  );

-- SELECT: Ministry leaders can see their own ministry's budgets
create policy "ministry_budgets_select_leader"
  on public.ministry_budgets
  for select
  using (
    exists (
      select 1 from public.ministries
      where ministries.id = ministry_budgets.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );

-- INSERT: Ministry leaders can create budgets for their ministry
create policy "ministry_budgets_insert_leader"
  on public.ministry_budgets
  for insert
  with check (
    exists (
      select 1 from public.ministries
      where ministries.id = ministry_budgets.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );

-- UPDATE: Ministry leaders can update their own ministry's budgets
create policy "ministry_budgets_update_leader"
  on public.ministry_budgets
  for update
  using (
    exists (
      select 1 from public.ministries
      where ministries.id = ministry_budgets.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );

-- UPDATE: Admin and secretary can update all budgets (for acknowledgement in future)
create policy "ministry_budgets_update_admin_secretary"
  on public.ministry_budgets
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrator', 'secretary')
      and profiles.is_active = true
    )
  );

-- DELETE: Admin, secretary, and ministry leaders can delete budgets
create policy "ministry_budgets_delete_all"
  on public.ministry_budgets
  for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrator', 'secretary')
      and profiles.is_active = true
    )
    or exists (
      select 1 from public.ministries
      where ministries.id = ministry_budgets.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );
