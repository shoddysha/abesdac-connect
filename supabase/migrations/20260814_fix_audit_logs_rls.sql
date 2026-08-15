-- Fix audit_logs RLS: allow ministry_leader and secretary to read activity logs.
-- Previously only administrator and pastor could SELECT, which caused the
-- Recent Activity card to silently show empty for ministry leaders.

drop policy if exists "audit_logs_select_admin_pastor" on public.audit_logs;

create policy "audit_logs_select_authenticated_roles" on public.audit_logs
  for select using (
    public.current_role() in ('administrator', 'pastor', 'secretary', 'ministry_leader')
  );
