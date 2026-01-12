-- Drop the overly permissive "Require authentication for profiles" policy
-- This policy allows ANY authenticated user to view ALL profiles
-- The "Users can view accessible profiles" policy already properly restricts access to:
-- 1. Own profile
-- 2. Team members (same team_id)
-- 3. Supervisors can see their team/direct reports
-- 4. Admin roles have full access
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;