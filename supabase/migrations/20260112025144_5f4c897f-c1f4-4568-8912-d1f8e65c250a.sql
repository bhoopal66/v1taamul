-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Agents can view own and assigned contacts" ON public.master_contacts;

-- Create a more restrictive SELECT policy with 30-day time limit for agents
-- Agents can only view contacts where:
-- 1. They are the current owner
-- 2. They originally uploaded the contact (within 30 days of upload)
-- 3. They have an active assignment via approved_call_list (within 30 days of assignment)
-- Supervisors, operations_head, admin, super_admin have unrestricted access

CREATE POLICY "Agents can view contacts with time limit"
ON public.master_contacts
FOR SELECT
USING (
  -- Current owner always has access
  (current_owner_agent_id = auth.uid())
  OR
  -- Original uploader has 30-day access from upload date
  (
    first_uploaded_by = auth.uid() 
    AND first_upload_date >= (now() - interval '30 days')
  )
  OR
  -- Agents assigned via call list have 30-day access from assignment date
  (EXISTS (
    SELECT 1
    FROM approved_call_list acl
    WHERE acl.contact_id = master_contacts.id 
      AND acl.agent_id = auth.uid()
      AND acl.created_at >= (now() - interval '30 days')
  ))
  OR
  -- Management roles have full access
  has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);