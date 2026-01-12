-- Drop existing SELECT policy and create a new one that includes admin and super_admin
DROP POLICY IF EXISTS "Users can view leads" ON public.leads;

-- Create new policy that allows admins and super_admins to view all leads
CREATE POLICY "Users can view leads" 
ON public.leads 
FOR SELECT 
USING (
  (agent_id = auth.uid()) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'operations_head'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);