-- Drop existing policies on master_contacts
DROP POLICY IF EXISTS "Agents can view assigned contacts only" ON public.master_contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON public.master_contacts;

-- Create improved SELECT policy that restricts supervisors to their team's contacts
CREATE POLICY "Users can view contacts within access scope"
ON public.master_contacts
FOR SELECT
USING (
  -- Agents can see contacts they own or are on their call list today
  (current_owner_agent_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM approved_call_list acl
    WHERE acl.contact_id = master_contacts.id 
    AND acl.agent_id = auth.uid() 
    AND acl.list_date = CURRENT_DATE
  ))
  -- Supervisors can only see contacts owned by agents they supervise or on their team
  OR (
    has_role(auth.uid(), 'supervisor'::app_role) 
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = master_contacts.current_owner_agent_id
      AND (p.supervisor_id = auth.uid() OR p.team_id = get_user_team_id(auth.uid()))
    )
  )
  -- Operations head can see contacts from agents on teams they have oversight of
  OR (
    has_role(auth.uid(), 'operations_head'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = master_contacts.current_owner_agent_id
      AND p.team_id IN (
        SELECT id FROM teams WHERE leader_id = auth.uid()
        UNION
        SELECT team_id FROM profiles WHERE supervisor_id = auth.uid()
      )
    )
  )
  -- Admins and super_admins have full access
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  -- Pool contacts are visible to supervisors and above
  OR (
    in_company_pool = true 
    AND (
      has_role(auth.uid(), 'supervisor'::app_role) 
      OR has_role(auth.uid(), 'operations_head'::app_role)
    )
  )
);

-- Create improved UPDATE policy with same team-scoped restrictions
CREATE POLICY "Users can update contacts within access scope"
ON public.master_contacts
FOR UPDATE
USING (
  -- Agents can update contacts they own
  (current_owner_agent_id = auth.uid())
  -- Supervisors can only update contacts owned by agents they supervise or on their team
  OR (
    has_role(auth.uid(), 'supervisor'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = master_contacts.current_owner_agent_id
      AND (p.supervisor_id = auth.uid() OR p.team_id = get_user_team_id(auth.uid()))
    )
  )
  -- Operations head - team-scoped
  OR (
    has_role(auth.uid(), 'operations_head'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = master_contacts.current_owner_agent_id
      AND p.team_id IN (
        SELECT id FROM teams WHERE leader_id = auth.uid()
        UNION
        SELECT team_id FROM profiles WHERE supervisor_id = auth.uid()
      )
    )
  )
  -- Full admin access
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);