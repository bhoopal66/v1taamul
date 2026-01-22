-- Fix switch_activity function to use auth.uid() instead of accepting user_id parameter
-- This prevents user impersonation attacks via direct RPC calls

CREATE OR REPLACE FUNCTION public.switch_activity(
  p_activity_type activity_type,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_now TIMESTAMP WITH TIME ZONE;
  v_new_log_id UUID;
BEGIN
  -- Get authenticated user ID (cannot be spoofed)
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  v_now := now();
  
  -- Close any open activity for the authenticated user
  UPDATE activity_logs
  SET 
    ended_at = v_now,
    duration_minutes = EXTRACT(EPOCH FROM (v_now - started_at)) / 60
  WHERE user_id = v_user_id
    AND ended_at IS NULL;
  
  -- Insert new activity for the authenticated user
  INSERT INTO activity_logs (user_id, activity_type, started_at, metadata)
  VALUES (v_user_id, p_activity_type, v_now, p_metadata)
  RETURNING id INTO v_new_log_id;
  
  RETURN v_new_log_id;
END;
$$;