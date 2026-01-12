-- Fix the profiles_secure view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures RLS policies of the querying user are applied

DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  -- Only show full email to the owner, masked to others
  CASE 
    WHEN id = auth.uid() THEN email
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN email
    ELSE mask_email(email::text)
  END as email,
  full_name,
  avatar_url,
  team_id,
  supervisor_id,
  -- Only show phone to owner or admin
  CASE 
    WHEN id = auth.uid() THEN phone_number
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN phone_number
    ELSE mask_phone(phone_number::text)
  END as phone_number,
  -- Only show WhatsApp to owner or admin
  CASE 
    WHEN id = auth.uid() THEN whatsapp_number
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role) THEN whatsapp_number
    ELSE mask_phone(whatsapp_number::text)
  END as whatsapp_number,
  is_active,
  last_login,
  last_login_date,
  login_streak_current,
  login_streak_longest,
  created_at,
  updated_at
FROM public.profiles;