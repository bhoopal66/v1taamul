-- Fix profiles table sensitive data exposure
-- First drop existing functions with different signatures
DROP FUNCTION IF EXISTS public.get_public_profile_info(uuid);
DROP FUNCTION IF EXISTS public.get_own_profile();

-- Create helper function to get limited profile info (non-PII)
CREATE OR REPLACE FUNCTION public.get_public_profile_info(profile_id uuid)
RETURNS TABLE(
  id uuid,
  username varchar,
  full_name varchar,
  avatar_url text,
  is_active boolean,
  team_id uuid,
  supervisor_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.is_active,
    p.team_id,
    p.supervisor_id,
    p.created_at
  FROM profiles p
  WHERE p.id = profile_id;
$$;

-- Create function to get own full profile (including PII)
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS TABLE(
  id uuid,
  username varchar,
  full_name varchar,
  email varchar,
  phone_number varchar,
  whatsapp_number varchar,
  avatar_url text,
  is_active boolean,
  team_id uuid,
  supervisor_id uuid,
  login_streak_current int,
  login_streak_longest int,
  last_login_date date,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.email,
    p.phone_number,
    p.whatsapp_number,
    p.avatar_url,
    p.is_active,
    p.team_id,
    p.supervisor_id,
    p.login_streak_current,
    p.login_streak_longest,
    p.last_login_date,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.id = auth.uid();
$$;

-- Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Management can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Supervisors can view direct reports and team members" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Supervisors can view team member basic info" ON public.profiles;
DROP POLICY IF EXISTS "Management can view profiles for team operations" ON public.profiles;

-- Create new restrictive SELECT policies
-- Users can ONLY view their own FULL profile
CREATE POLICY "Users can view own full profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Supervisors can view team members' profiles (for team management)
-- PII access should ideally be via secure functions but we restrict to team hierarchy
CREATE POLICY "Supervisors can view team member profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  AND (
    supervisor_id = auth.uid() 
    OR team_id IN (SELECT teams.id FROM teams WHERE teams.leader_id = auth.uid())
  )
);

-- Management can view all profiles for operational needs
CREATE POLICY "Management can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'operations_head'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Recreate profiles_public view with ONLY non-PII fields
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public AS
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  is_active,
  team_id,
  supervisor_id,
  login_streak_current,
  login_streak_longest,
  last_login_date,
  created_at,
  updated_at
FROM profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- Recreate profiles_secure view for admin-only PII access
DROP VIEW IF EXISTS public.profiles_secure;
CREATE VIEW public.profiles_secure AS
SELECT 
  id,
  username,
  full_name,
  email,
  phone_number,
  whatsapp_number,
  avatar_url,
  is_active,
  team_id,
  supervisor_id,
  login_streak_current,
  login_streak_longest,
  last_login_date,
  created_at,
  updated_at,
  last_login
FROM profiles
WHERE 
  id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role);

GRANT SELECT ON public.profiles_secure TO authenticated;

-- Add documentation comment
COMMENT ON TABLE public.profiles IS 'User profiles with PII. Use profiles_public view for non-sensitive data. PII (email, phone, whatsapp) access restricted to own profile, team supervisors, and management.';