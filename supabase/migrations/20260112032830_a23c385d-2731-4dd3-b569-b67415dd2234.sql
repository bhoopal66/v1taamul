-- Add role check to move_old_contacts_to_pool function to prevent unauthorized access
-- This function uses SECURITY DEFINER but should only be callable by admins

CREATE OR REPLACE FUNCTION public.move_old_contacts_to_pool()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved_count INTEGER;
  calling_user_id UUID;
BEGIN
  -- Get the calling user's ID
  calling_user_id := auth.uid();
  
  -- Check if caller is authenticated
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to execute this function';
  END IF;
  
  -- Check if the user has admin or super_admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = calling_user_id 
    AND role IN ('admin', 'super_admin', 'operations_head')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can move contacts to the company pool';
  END IF;

  -- Move contacts that haven't been touched in 30 days and are not already in pool
  UPDATE master_contacts
  SET 
    in_company_pool = true,
    current_owner_agent_id = NULL,
    pool_entry_date = now()
  WHERE 
    first_upload_date < (now() - interval '30 days')
    AND in_company_pool = false
    AND id NOT IN (
      -- Exclude contacts with recent activity (within last 30 days)
      SELECT DISTINCT contact_id FROM call_feedback 
      WHERE call_timestamp > (now() - interval '30 days')
      UNION
      SELECT DISTINCT contact_id FROM leads 
      WHERE created_at > (now() - interval '30 days')
    );
  
  GET DIAGNOSTICS moved_count = ROW_COUNT;
  
  -- Log the operation for audit purposes
  RAISE NOTICE 'Moved % contacts to company pool by user %', moved_count, calling_user_id;
  
  RETURN moved_count;
END;
$$;