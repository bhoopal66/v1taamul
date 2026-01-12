-- Enable FORCE ROW LEVEL SECURITY to ensure all access goes through RLS policies
-- This prevents superusers/table owners from bypassing security policies
ALTER TABLE public.master_contacts FORCE ROW LEVEL SECURITY;