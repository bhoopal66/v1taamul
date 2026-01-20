-- Drop and recreate the overly permissive policy with better restrictions
DROP POLICY IF EXISTS "System can insert alerts" ON public.supervisor_alerts;

-- Allow users to insert alerts (agent creates alert for their supervisor)
CREATE POLICY "Users can insert alerts for supervisors"
ON public.supervisor_alerts
FOR INSERT
WITH CHECK (
  agent_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);