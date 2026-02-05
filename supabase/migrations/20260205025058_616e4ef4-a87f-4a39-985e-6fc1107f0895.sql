-- Update call_feedback SELECT policy to include admin and super_admin roles
DROP POLICY IF EXISTS "Users can view feedback" ON public.call_feedback;

CREATE POLICY "Users can view feedback"
ON public.call_feedback
FOR SELECT
USING (
  (agent_id = auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Also update leads table if needed
DROP POLICY IF EXISTS "Users can view leads" ON public.leads;

CREATE POLICY "Users can view leads"
ON public.leads
FOR SELECT
USING (
  (agent_id = auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update master_contacts to allow global access for management roles
DROP POLICY IF EXISTS "Users can view contacts" ON public.master_contacts;

CREATE POLICY "Users can view contacts"
ON public.master_contacts
FOR SELECT
USING (
  (current_owner_agent_id = auth.uid())
  OR (first_uploaded_by = auth.uid())
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);