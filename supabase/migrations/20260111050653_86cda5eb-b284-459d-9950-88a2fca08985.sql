-- Create enum for team type
CREATE TYPE public.team_type AS ENUM ('remote', 'office');

-- Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    team_type public.team_type NOT NULL,
    leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add team_id to profiles
ALTER TABLE public.profiles
ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Enable RLS on teams table
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is a team leader
CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND leader_id = _user_id
  )
$$;

-- Create security definer function to get user's team id as leader
CREATE OR REPLACE FUNCTION public.get_led_team_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.teams
  WHERE leader_id = _user_id
  LIMIT 1
$$;

-- Create security definer function to get user's team id as member
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- RLS Policies for teams table

-- Everyone authenticated can view teams they belong to or lead
CREATE POLICY "Users can view their own team"
ON public.teams
FOR SELECT
TO authenticated
USING (
  id = public.get_user_team_id(auth.uid())
  OR leader_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Only admins and super_admins can create teams
CREATE POLICY "Admins can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Only admins and super_admins can update teams
CREATE POLICY "Admins can update teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Only admins and super_admins can delete teams
CREATE POLICY "Admins can delete teams"
ON public.teams
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Update profiles RLS to allow team leaders to view their team members
-- First drop existing select policy if it conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy that includes team leader access
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR team_id = public.get_led_team_id(auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'operations_head')
);

-- Create trigger to update updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();