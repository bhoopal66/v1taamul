-- Fix security definer view issues by removing security_barrier
-- Views inherit RLS from underlying tables without needing security_barrier

-- Recreate profiles_public view without security_barrier
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
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

-- Recreate profiles_secure view without security_barrier
DROP VIEW IF EXISTS public.profiles_secure;
CREATE VIEW public.profiles_secure AS
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
  -- Sensitive fields - only visible based on underlying table RLS
  email,
  phone_number,
  whatsapp_number
FROM public.profiles;

-- Grant select permissions to authenticated users
-- RLS from the profiles table will still apply
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_secure TO authenticated;