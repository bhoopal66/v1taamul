-- Fix master_contacts RLS to allow supervisors to see contacts with call feedback from their team
DROP POLICY IF EXISTS "Users can view contacts within access scope" ON master_contacts;

CREATE POLICY "Users can view contacts within access scope"
ON master_contacts FOR SELECT
USING (
  -- Owner can see their contacts
  (current_owner_agent_id = auth.uid())
  -- Agent has this contact in their call list for today
  OR (EXISTS (
    SELECT 1 FROM approved_call_list acl
    WHERE acl.contact_id = master_contacts.id 
    AND acl.agent_id = auth.uid()
    AND acl.list_date = CURRENT_DATE
  ))
  -- Supervisors can see contacts owned by their team members
  OR (has_role(auth.uid(), 'supervisor'::app_role) AND (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = master_contacts.current_owner_agent_id 
      AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
    )
  ))
  -- Supervisors can also see contacts that have call feedback from their team
  OR (has_role(auth.uid(), 'supervisor'::app_role) AND (
    EXISTS (
      SELECT 1 FROM call_feedback cf
      JOIN profiles p ON p.id = cf.agent_id
      WHERE cf.contact_id = master_contacts.id
      AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
    )
  ))
  -- Operations heads can see contacts from their teams
  OR (has_role(auth.uid(), 'operations_head'::app_role) AND (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = master_contacts.current_owner_agent_id 
      AND p.team_id IN (
        SELECT id FROM teams WHERE leader_id = auth.uid()
        UNION
        SELECT team_id FROM profiles WHERE supervisor_id = auth.uid()
      )
    )
  ))
  -- Operations heads can also see contacts with call feedback from their teams
  OR (has_role(auth.uid(), 'operations_head'::app_role) AND (
    EXISTS (
      SELECT 1 FROM call_feedback cf
      JOIN profiles p ON p.id = cf.agent_id
      WHERE cf.contact_id = master_contacts.id
      AND p.team_id IN (
        SELECT id FROM teams WHERE leader_id = auth.uid()
        UNION
        SELECT team_id FROM profiles WHERE supervisor_id = auth.uid()
      )
    )
  ))
  -- Admins can see all
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  -- Pool contacts are visible to management
  OR ((in_company_pool = true) AND (
    has_role(auth.uid(), 'supervisor'::app_role) 
    OR has_role(auth.uid(), 'operations_head'::app_role)
  ))
);

-- Ensure profiles_public view allows all authenticated users to see basic profile info
-- This is needed for supervisor console to display agent names
DROP VIEW IF EXISTS profiles_public;

CREATE VIEW profiles_public 
WITH (security_invoker=false)
AS SELECT 
  id,
  username,
  full_name,
  avatar_url,
  team_id,
  supervisor_id,
  is_active,
  login_streak_current,
  login_streak_longest,
  last_login_date,
  created_at,
  updated_at
FROM profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON profiles_public TO authenticated;