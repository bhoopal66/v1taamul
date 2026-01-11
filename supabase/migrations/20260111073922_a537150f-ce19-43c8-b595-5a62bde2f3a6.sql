-- Create table for daily talk time entries
CREATE TABLE public.agent_talk_time (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  talk_time_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.agent_talk_time ENABLE ROW LEVEL SECURITY;

-- Agents can view their own talk time entries
CREATE POLICY "Agents can view their own talk time"
ON public.agent_talk_time
FOR SELECT
USING (auth.uid() = agent_id);

-- Agents can insert their own talk time entries
CREATE POLICY "Agents can insert their own talk time"
ON public.agent_talk_time
FOR INSERT
WITH CHECK (auth.uid() = agent_id);

-- Agents can update their own talk time entries
CREATE POLICY "Agents can update their own talk time"
ON public.agent_talk_time
FOR UPDATE
USING (auth.uid() = agent_id);

-- Supervisors can view all talk time entries
CREATE POLICY "Supervisors can view all talk time"
ON public.agent_talk_time
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('supervisor', 'operations_head', 'admin', 'super_admin')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_agent_talk_time_updated_at
BEFORE UPDATE ON public.agent_talk_time
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();