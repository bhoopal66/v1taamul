-- Drop and recreate profiles_public view with security_invoker enabled
-- This ensures the view respects RLS policies from the underlying profiles table
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

-- Grant select to authenticated users (view will still respect RLS)
GRANT SELECT ON public.profiles_public TO authenticated;

-- Drop and recreate profiles_secure view with security_invoker enabled
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  full_name,
  email,
  phone_number,
  whatsapp_number,
  avatar_url,
  team_id,
  supervisor_id,
  is_active,
  login_streak_current,
  login_streak_longest,
  last_login,
  last_login_date,
  created_at,
  updated_at
FROM public.profiles;

-- Grant select to authenticated users (view will still respect RLS)
GRANT SELECT ON public.profiles_secure TO authenticated;

-- Revoke access from anon role to prevent public access
REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.profiles_secure FROM anon;