-- Fix agent_goals table RLS policy to add proper team-based restrictions

-- Drop the existing supervisor policy that only checks supervisor_id
DROP POLICY IF EXISTS "Supervisors can view team goals" ON public.agent_goals;

-- Create a comprehensive supervisor view policy that includes:
-- 1. Direct reports (supervisor_id = auth.uid())
-- 2. Team members (agent is in a team led by the supervisor)
-- 3. Operations head, admin, super_admin can see all goals
CREATE POLICY "Supervisors can view team goals"
ON public.agent_goals
FOR SELECT
USING (
  -- Own goals - always allowed
  auth.uid() = agent_id
  OR
  -- Org-wide roles can see all goals
  has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR
  -- Supervisors can only see goals for their team members
  (
    has_role(auth.uid(), 'supervisor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = agent_goals.agent_id
      AND (
        p.supervisor_id = auth.uid()
        OR p.team_id = get_led_team_id(auth.uid())
      )
    )
  )
);