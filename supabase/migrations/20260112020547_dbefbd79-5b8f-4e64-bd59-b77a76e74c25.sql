-- Drop the current overly permissive SELECT policy on master_contacts
DROP POLICY IF EXISTS "Agents can view contacts" ON public.master_contacts;

-- Create a new restricted policy for viewing contacts
-- Agents can only view contacts where:
-- 1. They are the current owner (current_owner_agent_id = auth.uid())
-- 2. They originally uploaded it (first_uploaded_by = auth.uid())
-- 3. The contact was assigned to them via approved_call_list
-- Supervisors/admins retain full access

CREATE POLICY "Agents can view own and assigned contacts"
ON public.master_contacts
FOR SELECT
USING (
  -- Agent is the current owner
  (current_owner_agent_id = auth.uid())
  OR
  -- Agent originally uploaded this contact
  (first_uploaded_by = auth.uid())
  OR
  -- Contact was assigned to this agent via approved_call_list
  (EXISTS (
    SELECT 1 FROM public.approved_call_list acl
    WHERE acl.contact_id = master_contacts.id
    AND acl.agent_id = auth.uid()
  ))
  OR
  -- Supervisors, operations_head, admins, super_admins can view all
  has_role(auth.uid(), 'supervisor'::app_role)
  OR
  has_role(auth.uid(), 'operations_head'::app_role)
  OR
  has_role(auth.uid(), 'admin'::app_role)
  OR
  has_role(auth.uid(), 'super_admin'::app_role)
);