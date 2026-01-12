-- Fix master_contacts RLS policy to restrict access window
-- Remove 30-day access windows to prevent data extraction by departing employees
-- Agents should only see contacts they currently own OR that are in their CURRENT call list

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Agents can view contacts with time limit" ON public.master_contacts;

-- Create new restrictive SELECT policy
-- Agents can only see:
-- 1. Contacts they currently own (current_owner_agent_id = auth.uid())
-- 2. Contacts in their call list for TODAY only (approved_call_list with list_date = today)
-- 3. Supervisors/Management have broader access
CREATE POLICY "Agents can view assigned contacts only" 
ON public.master_contacts 
FOR SELECT 
TO authenticated
USING (
  -- Current owner can always see their contacts
  (current_owner_agent_id = auth.uid()) 
  OR 
  -- Contacts in agent's call list for today only
  (EXISTS (
    SELECT 1 FROM approved_call_list acl
    WHERE acl.contact_id = master_contacts.id 
    AND acl.agent_id = auth.uid() 
    AND acl.list_date = CURRENT_DATE
  ))
  OR 
  -- Supervisors and management roles have full access
  has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'operations_head'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);