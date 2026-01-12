-- Restrict DNC list access to only operations_head, admin, and super_admin for compliance oversight
-- Remove supervisor and sales_controller from the access list

-- Drop existing policies
DROP POLICY IF EXISTS "Supervisors and above can view DNC list" ON public.do_not_call_list;
DROP POLICY IF EXISTS "Supervisors and above can insert DNC" ON public.do_not_call_list;
DROP POLICY IF EXISTS "Supervisors and above can update DNC" ON public.do_not_call_list;
DROP POLICY IF EXISTS "Supervisors and above can delete DNC" ON public.do_not_call_list;

-- Create new restrictive policies - only operations_head, admin, super_admin
CREATE POLICY "Compliance roles can view DNC list" 
ON public.do_not_call_list 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('operations_head', 'admin', 'super_admin')
  )
);

CREATE POLICY "Compliance roles can insert DNC" 
ON public.do_not_call_list 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('operations_head', 'admin', 'super_admin')
  )
);

CREATE POLICY "Compliance roles can update DNC" 
ON public.do_not_call_list 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('operations_head', 'admin', 'super_admin')
  )
);

CREATE POLICY "Compliance roles can delete DNC" 
ON public.do_not_call_list 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('operations_head', 'admin', 'super_admin')
  )
);