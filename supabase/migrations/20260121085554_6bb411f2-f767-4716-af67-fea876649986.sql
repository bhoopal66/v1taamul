-- Create table for storing upload processing logs
CREATE TABLE public.upload_processing_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id uuid REFERENCES public.call_sheet_uploads(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  agent_id uuid NOT NULL,
  file_name text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  log_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX idx_upload_logs_upload_id ON public.upload_processing_logs(upload_id);
CREATE INDEX idx_upload_logs_agent_id ON public.upload_processing_logs(agent_id);
CREATE INDEX idx_upload_logs_session_id ON public.upload_processing_logs(session_id);
CREATE INDEX idx_upload_logs_started_at ON public.upload_processing_logs(started_at DESC);

-- Enable RLS
ALTER TABLE public.upload_processing_logs ENABLE ROW LEVEL SECURITY;

-- Agents can insert their own logs
CREATE POLICY "Agents can insert own logs"
ON public.upload_processing_logs
FOR INSERT
WITH CHECK (agent_id = auth.uid());

-- Agents can view their own logs
CREATE POLICY "Agents can view own logs"
ON public.upload_processing_logs
FOR SELECT
USING (agent_id = auth.uid());

-- Supervisors and admins can view all logs
CREATE POLICY "Supervisors can view all logs"
ON public.upload_processing_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'operations_head'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Agents can update their own logs (for adding entries during processing)
CREATE POLICY "Agents can update own logs"
ON public.upload_processing_logs
FOR UPDATE
USING (agent_id = auth.uid());