-- Create enum for submission groups
CREATE TYPE public.submission_group AS ENUM ('group1', 'group2');

-- Create table for daily submissions
CREATE TABLE public.agent_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submission_group submission_group NOT NULL,
  bank_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, submission_date, bank_name)
);

-- Enable RLS
ALTER TABLE public.agent_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for agent submissions
CREATE POLICY "Agents can view their own submissions"
ON public.agent_submissions
FOR SELECT
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can create their own submissions"
ON public.agent_submissions
FOR INSERT
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own submissions"
ON public.agent_submissions
FOR UPDATE
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can delete their own submissions"
ON public.agent_submissions
FOR DELETE
USING (auth.uid() = agent_id);

-- Trigger for updated_at
CREATE TRIGGER update_agent_submissions_updated_at
BEFORE UPDATE ON public.agent_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();