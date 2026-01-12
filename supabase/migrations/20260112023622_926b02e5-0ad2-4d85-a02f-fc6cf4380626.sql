-- Fix profiles table RLS policies to prevent cross-team data exposure

-- Step 1: Drop the overly permissive "Users can view profiles" policy that allows 
-- any supervisor to see ALL profiles (the security vulnerability)
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Step 2: Update the existing policy to be more comprehensive and properly named
-- The existing "Supervisors can view their team profiles only" policy is correct
-- but we need to also allow agents to see basic info of their teammates

-- First, drop the old policy so we can recreate it with better logic
DROP POLICY IF EXISTS "Supervisors can view their team profiles only" ON public.profiles;

-- Step 3: Create a comprehensive SELECT policy that properly restricts access:
-- - Users can always view their own profile
-- - Supervisors can only view profiles of their direct reports OR team members they lead
-- - Operations head, admin, super_admin can view all profiles (org-wide oversight)
-- - Regular agents can view profiles of people in their same team (for leaderboard, etc.)
CREATE POLICY "Users can view accessible profiles"
ON public.profiles
FOR SELECT
USING (
  -- Own profile - always allowed
  id = auth.uid()
  OR 
  -- Org-wide roles can see all profiles
  has_role(auth.uid(), 'operations_head'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR 
  -- Supervisors can only see their team members (led team or direct reports)
  (
    has_role(auth.uid(), 'supervisor'::app_role) 
    AND (
      team_id = get_led_team_id(auth.uid()) 
      OR supervisor_id = auth.uid()
    )
  )
  OR
  -- Agents in the same team can see each other (for leaderboard features)
  -- This is restricted to same team only - no cross-team visibility
  (
    team_id IS NOT NULL 
    AND team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Step 4: Create a security definer function to get only public profile info
-- This can be used when peers need to see limited data (username, avatar only)
CREATE OR REPLACE FUNCTION public.get_public_profile_info(profile_id uuid)
RETURNS TABLE(id uuid, username varchar, avatar_url text, full_name varchar)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.avatar_url, p.full_name
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;