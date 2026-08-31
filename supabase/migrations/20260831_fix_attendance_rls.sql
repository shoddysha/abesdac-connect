-- Fix attendance RLS policy to allow authenticated users to read attendance records
-- The 406 error occurs because the policy check is too restrictive

-- Drop existing policy
DROP POLICY IF EXISTS "attendance_select_all" ON public.attendance;

-- Create new policy that properly allows authenticated users to read
CREATE POLICY "attendance_select_all" ON public.attendance
  FOR SELECT 
  USING (
    -- Allow if user is authenticated and has a valid profile
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND is_active = true
    )
  );

-- Also ensure the write policies are correct
DROP POLICY IF EXISTS "attendance_write_admin_secretary" ON public.attendance;
CREATE POLICY "attendance_write_admin_secretary" ON public.attendance
  FOR ALL 
  USING (
    public.current_role() IN ('administrator', 'secretary')
  )
  WITH CHECK (
    public.current_role() IN ('administrator', 'secretary')
  );

DROP POLICY IF EXISTS "attendance_write_leader_own_ministry" ON public.attendance;
CREATE POLICY "attendance_write_leader_own_ministry" ON public.attendance
  FOR INSERT 
  WITH CHECK (
    public.current_role() = 'ministry_leader'
    AND member_id IN (
      SELECT mm.member_id 
      FROM public.ministry_members mm
      JOIN public.ministries m ON m.id = mm.ministry_id
      WHERE m.leader_id = auth.uid()
    )
  );
