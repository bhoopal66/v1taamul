-- Add column to track company pool status and pool entry date
ALTER TABLE public.master_contacts 
ADD COLUMN IF NOT EXISTS in_company_pool boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pool_entry_date timestamp with time zone;

-- Update RLS policy to allow all authenticated users to view company pool contacts
DROP POLICY IF EXISTS "Agents can view owned contacts" ON public.master_contacts;

CREATE POLICY "Agents can view contacts"
ON public.master_contacts
FOR SELECT
USING (
  (current_owner_agent_id = auth.uid()) 
  OR (first_uploaded_by = auth.uid()) 
  OR (in_company_pool = true)
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'operations_head'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow admins/super_admins to update any contact (for reassignment, pool management)
DROP POLICY IF EXISTS "Agents can update owned contacts" ON public.master_contacts;

CREATE POLICY "Users can update contacts"
ON public.master_contacts
FOR UPDATE
USING (
  (current_owner_agent_id = auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'operations_head'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow admins/super_admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow super_admins to manage user_roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;

CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow admins to manage non-admin roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND role NOT IN ('admin'::app_role, 'super_admin'::app_role)
);

-- Allow users to view their own roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Function to move old contacts to company pool (run periodically or on demand)
CREATE OR REPLACE FUNCTION public.move_old_contacts_to_pool()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved_count integer;
BEGIN
  UPDATE master_contacts
  SET 
    in_company_pool = true,
    pool_entry_date = now(),
    current_owner_agent_id = null
  WHERE 
    in_company_pool = false 
    AND first_upload_date < (now() - interval '1 month');
  
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;