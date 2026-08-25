-- Enable RLS on ministry_reports table
alter table public.ministry_reports enable row level security;

-- Drop existing policies if any
drop policy if exists "ministry_reports_select_all" on public.ministry_reports;
drop policy if exists "ministry_reports_select_admin_secretary" on public.ministry_reports;
drop policy if exists "ministry_reports_select_leader" on public.ministry_reports;
drop policy if exists "ministry_reports_insert_leader" on public.ministry_reports;
drop policy if exists "ministry_reports_update_leader" on public.ministry_reports;
drop policy if exists "ministry_reports_update_admin_secretary" on public.ministry_reports;
drop policy if exists "ministry_reports_delete_all" on public.ministry_reports;

-- SELECT: Admin and Secretary can see ALL reports
create policy "ministry_reports_select_admin_secretary"
  on public.ministry_reports
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrator', 'secretary')
      and profiles.is_active = true
    )
  );

-- SELECT: Ministry leaders can see their own ministry's reports
create policy "ministry_reports_select_leader"
  on public.ministry_reports
  for select
  using (
    exists (
      select 1 from public.ministries
      where ministries.id = ministry_reports.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );

-- INSERT: Ministry leaders can create reports for their ministry
create policy "ministry_reports_insert_leader"
  on public.ministry_reports
  for insert
  with check (
    exists (
      select 1 from public.ministries
      where ministries.id = ministry_reports.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );

-- UPDATE: Ministry leaders can update their own ministry's reports
create policy "ministry_reports_update_leader"
  on public.ministry_reports
  for update
  using (
    exists (
      select 1 from public.ministries
      where ministries.id = ministry_reports.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );

-- UPDATE: Admin and secretary can update all reports (for acknowledgement)
create policy "ministry_reports_update_admin_secretary"
  on public.ministry_reports
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('administrator', 'secretary')
      and profiles.is_active = true
    )
  );

-- DELETE: Admin, secretary, and ministry leaders can delete reports
create policy "ministry_reports_delete_all"
  on public.ministry_reports
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
      where ministries.id = ministry_reports.ministry_id
      and ministries.leader_id = auth.uid()
    )
  );
