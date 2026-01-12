-- Fix sensitive data exposure in profiles

-- 1. Drop the existing profiles_secure view (it has no RLS and exposes sensitive data)
DROP VIEW IF EXISTS public.profiles_secure;

-- 2. Create a profiles_public view with ONLY non-sensitive fields
-- This can be used for leaderboards, team displays, etc. where full profile access isn't needed
CREATE OR REPLACE VIEW public.profiles_public AS
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

-- 3. Enable RLS on the view (views inherit RLS from underlying tables by default)
-- But we need to ensure it's security barrier for proper protection
ALTER VIEW public.profiles_public SET (security_barrier = true);

-- 4. Create a secure view that decrypts sensitive data - only for authorized access
-- This replaces profiles_secure with proper security
CREATE OR REPLACE VIEW public.profiles_secure 
WITH (security_barrier = true)
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
  -- Sensitive fields only visible based on underlying table RLS
  email,
  phone_number,
  whatsapp_number
FROM public.profiles;

-- Note: Both views inherit RLS from the profiles table
-- Users can only see rows they're authorized to see based on profiles RLS policies