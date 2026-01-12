-- Fix profiles table RLS policies to properly restrict visibility
-- The issue: agents should ONLY see their own profile
-- Supervisors should only see their direct reports (via supervisor_id OR team_id they lead)
-- Management (ops_head, admin, super_admin) can see all

-- First, drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Supervisors can view direct reports" ON public.profiles;
DROP POLICY IF EXISTS "Management can view all profiles" ON public.profiles;

-- Create new properly scoped SELECT policies

-- 1. All authenticated users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (id = auth.uid());

-- 2. Supervisors can view direct reports (via supervisor_id) AND agents in teams they lead
CREATE POLICY "Supervisors can view direct reports and team members" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND (
    -- Can view profiles where they are the supervisor
    supervisor_id = auth.uid() 
    OR 
    -- Can view profiles in teams they lead
    team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid())
  )
);

-- 3. Management roles can view all profiles
CREATE POLICY "Management can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'operations_head'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);