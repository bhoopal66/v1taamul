-- Create a function to check if a phone number is on the DNC list
-- This allows agents to verify individual numbers without accessing the full list
CREATE OR REPLACE FUNCTION public.check_dnc(phone_to_check text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM do_not_call_list 
    WHERE phone_number = phone_to_check
  )
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_dnc(text) TO authenticated;

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "All authenticated can view DNC" ON public.do_not_call_list;

-- Create new restrictive policy - only supervisors, operations_head, admin, super_admin, sales_controller can view full list
CREATE POLICY "Supervisors and above can view DNC list" 
ON public.do_not_call_list 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller')
  )
);

-- Supervisors and above can manage DNC entries
DROP POLICY IF EXISTS "Supervisors can manage DNC" ON public.do_not_call_list;

CREATE POLICY "Supervisors and above can insert DNC" 
ON public.do_not_call_list 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller')
  )
);

CREATE POLICY "Supervisors and above can update DNC" 
ON public.do_not_call_list 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller')
  )
);

CREATE POLICY "Supervisors and above can delete DNC" 
ON public.do_not_call_list 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller')
  )
);