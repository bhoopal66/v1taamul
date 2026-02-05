-- Drop the existing SELECT policy on call_feedback
DROP POLICY IF EXISTS "Agents can view their own call feedback" ON public.call_feedback;

-- Create updated SELECT policy that includes admin and super_admin roles
CREATE POLICY "Users can view call feedback based on role"
ON public.call_feedback
FOR SELECT
USING (
  agent_id = auth.uid()
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);