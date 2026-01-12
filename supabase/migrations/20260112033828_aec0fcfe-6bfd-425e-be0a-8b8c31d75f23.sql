-- Fix security definer view issues by setting SECURITY INVOKER
-- This ensures RLS policies of the querying user are enforced

-- Recreate profiles_public view with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public 
WITH (security_invoker = true)
AS
SELECT 
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
FROM public.profiles;

-- Recreate profiles_secure view with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_secure;
CREATE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
SELECT 
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
  updated_at,
  last_login,
  email,
  phone_number,
  whatsapp_number
FROM public.profiles;

-- Grant select permissions to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_secure TO authenticated;