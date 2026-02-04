-- Drop the restrictive insert policy and replace with one that allows admin allocation
DROP POLICY IF EXISTS "System can insert call list" ON public.approved_call_list;

-- Create new insert policy: agents can insert for themselves, admins can insert for anyone
CREATE POLICY "Agents and admins can insert call list" 
ON public.approved_call_list 
FOR INSERT 
WITH CHECK (
  agent_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);