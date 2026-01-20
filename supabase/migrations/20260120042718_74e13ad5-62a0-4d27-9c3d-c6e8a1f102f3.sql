-- Add new fields to attendance_records for session tracking
ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS start_button_pressed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_reason TEXT,
ADD COLUMN IF NOT EXISTS is_working BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_confirmation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS missed_confirmations INTEGER DEFAULT 0;

-- Add new fields to activity_logs for confirmation tracking
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmation_status TEXT,
ADD COLUMN IF NOT EXISTS auto_switch_reason TEXT,
ADD COLUMN IF NOT EXISTS activity_details TEXT;

-- Create a new table for supervisor alerts
CREATE TABLE IF NOT EXISTS public.supervisor_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  supervisor_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  agent_name TEXT,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on supervisor_alerts
ALTER TABLE public.supervisor_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for supervisor_alerts
CREATE POLICY "Supervisors can view own alerts"
ON public.supervisor_alerts
FOR SELECT
USING (supervisor_id = auth.uid());

CREATE POLICY "Supervisors can update own alerts"
ON public.supervisor_alerts
FOR UPDATE
USING (supervisor_id = auth.uid());

CREATE POLICY "System can insert alerts"
ON public.supervisor_alerts
FOR INSERT
WITH CHECK (true);

-- Create table for activity sessions (separate from attendance for clarity)
CREATE TABLE IF NOT EXISTS public.activity_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  end_reason TEXT,
  is_active BOOLEAN DEFAULT true,
  current_activity TEXT,
  current_activity_started_at TIMESTAMP WITH TIME ZONE,
  last_confirmation_at TIMESTAMP WITH TIME ZONE,
  missed_confirmations INTEGER DEFAULT 0,
  total_others_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS on activity_sessions
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for activity_sessions
CREATE POLICY "Users can view own sessions"
ON public.activity_sessions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
ON public.activity_sessions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
ON public.activity_sessions
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Supervisors can view team sessions"
ON public.activity_sessions
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = activity_sessions.user_id
    AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
  )
);

CREATE POLICY "Management can view all sessions"
ON public.activity_sessions
FOR SELECT
USING (
  has_role(auth.uid(), 'operations_head'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Create activity_confirmations table to log each 15-minute confirmation
CREATE TABLE IF NOT EXISTS public.activity_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.activity_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  prompted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  response_type TEXT, -- 'accepted', 'changed', 'auto_switched', 'missed'
  activity_before TEXT,
  activity_after TEXT,
  auto_switch_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on activity_confirmations
ALTER TABLE public.activity_confirmations ENABLE ROW LEVEL SECURITY;

-- Create policies for activity_confirmations
CREATE POLICY "Users can view own confirmations"
ON public.activity_confirmations
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own confirmations"
ON public.activity_confirmations
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own confirmations"
ON public.activity_confirmations
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Supervisors can view team confirmations"
ON public.activity_confirmations
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = activity_confirmations.user_id
    AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
  )
);

-- Enable realtime for supervisor_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.supervisor_alerts;

-- Enable realtime for activity_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_sessions;