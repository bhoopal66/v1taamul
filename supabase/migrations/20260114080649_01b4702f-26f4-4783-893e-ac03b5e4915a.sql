-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS public.check_duplicate_phone_numbers(text[]);

-- Recreate with owner name included
CREATE OR REPLACE FUNCTION public.check_duplicate_phone_numbers(phone_numbers text[])
RETURNS TABLE(phone_number text, exists_in_db boolean, owner_agent_id uuid, owner_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnested.phone AS phone_number,
    EXISTS(
      SELECT 1 FROM master_contacts mc 
      WHERE mc.phone_number = unnested.phone
    ) AS exists_in_db,
    (
      SELECT mc.current_owner_agent_id 
      FROM master_contacts mc 
      WHERE mc.phone_number = unnested.phone
      LIMIT 1
    ) AS owner_agent_id,
    (
      SELECT COALESCE(p.full_name, p.username, 'Unknown Agent')
      FROM master_contacts mc 
      LEFT JOIN profiles p ON p.id = mc.current_owner_agent_id
      WHERE mc.phone_number = unnested.phone
      LIMIT 1
    ) AS owner_name
  FROM unnest(phone_numbers) AS unnested(phone);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_duplicate_phone_numbers(text[]) TO authenticated;