-- Drop the overly permissive "Supervisors can view team profiles" policy
DROP POLICY IF EXISTS "Supervisors can view team profiles" ON public.profiles;

-- Create a new restricted policy for supervisors
-- Supervisors can only view profiles where:
-- 1. It's their own profile (id = auth.uid())
-- 2. The profile belongs to a team they lead (team_id = get_led_team_id(auth.uid()))
-- 3. They are the direct supervisor of the user (supervisor_id = auth.uid())
-- Admin/super_admin/operations_head can still view all profiles

CREATE POLICY "Supervisors can view their team profiles only"
ON public.profiles
FOR SELECT
USING (
  -- User can always view their own profile
  (id = auth.uid())
  OR
  -- Operations head and admins can view all profiles
  has_role(auth.uid(), 'operations_head'::app_role)
  OR
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'super_admin'::app_role)
  OR
  -- Supervisors can ONLY view profiles in the team they lead
  (
    has_role(auth.uid(), 'supervisor'::app_role)
    AND
    (
      -- Profile is in the team they lead
      team_id = get_led_team_id(auth.uid())
      OR
      -- They are the direct supervisor of this user
      supervisor_id = auth.uid()
    )
  )
);