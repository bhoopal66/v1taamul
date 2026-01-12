-- Add company_name column to agent_submissions table
ALTER TABLE public.agent_submissions 
ADD COLUMN company_name TEXT NOT NULL DEFAULT '';