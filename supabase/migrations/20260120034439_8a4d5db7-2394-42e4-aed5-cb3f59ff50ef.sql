-- Create enum for activity types
CREATE TYPE public.activity_type AS ENUM (
  'data_collection',
  'customer_followup',
  'calling_telecalling',
  'calling_coldcalling',
  'calling_calllist_movement',
  'client_meeting',
  'admin_documentation',
  'training',
  'system_bank_portal',
  'break',
  'idle'
);

-- Create enum for attendance status
CREATE TYPE public.attendance_status AS ENUM (
  'present',
  'late',
  'absent',
  'half_day'
);

-- Create enum for idle alert severity
CREATE TYPE public.idle_alert_severity AS ENUM (
  'warning',
  'escalation',
  'discipline_flag'
);

-- Activity logs table (immutable)
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type activity_type NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  is_system_enforced BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_activity_logs_user_date ON public.activity_logs(user_id, started_at);
CREATE INDEX idx_activity_logs_type ON public.activity_logs(activity_type);

-- Attendance records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_login TIMESTAMP WITH TIME ZONE,
  last_logout TIMESTAMP WITH TIME ZONE,
  total_work_minutes INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  status attendance_status,
  is_late BOOLEAN DEFAULT false,
  late_by_minutes INTEGER DEFAULT 0,
  daily_score NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Add indexes
CREATE INDEX idx_attendance_user_date ON public.attendance_records(user_id, date);

-- Idle alerts table
CREATE TABLE public.idle_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  severity idle_alert_severity NOT NULL,
  idle_duration_minutes INTEGER NOT NULL,
  was_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  escalated_to UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_idle_alerts_user_date ON public.idle_alerts(user_id, alert_time);

-- Activity configuration table (for configurable idle thresholds, etc.)
CREATE TABLE public.activity_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default configuration
INSERT INTO public.activity_config (config_key, config_value, description) VALUES
  ('idle_warning_minutes', '7', 'Minutes of inactivity before warning user'),
  ('idle_escalation_minutes', '15', 'Minutes of inactivity before escalating to supervisor'),
  ('daily_idle_limit', '3', 'Max idle incidents before flagging as Low Discipline'),
  ('calling_no_output_warning_minutes', '20', 'Minutes of calling with no output before warning'),
  ('calllist_movement_max_continuous_minutes', '10', 'Max continuous minutes for Call List Movement'),
  ('calllist_movement_daily_cap_percentage', '15', 'Max percentage of total calling time for Call List Movement'),
  ('work_start_time', '"10:00"', 'Work start time in Asia/Dubai'),
  ('work_end_time', '"19:00"', 'Work end time in Asia/Dubai'),
  ('late_threshold_minutes', '5', 'Minutes after work start to be considered late'),
  ('absent_threshold_minutes', '60', 'Minutes after work start with no login to be marked absent'),
  ('present_min_work_hours', '6', 'Minimum net working hours to be marked present'),
  ('break_schedule', '{"tea_morning": {"start": "11:15", "end": "11:30"}, "lunch": {"start": "13:15", "end": "14:15"}, "tea_afternoon": {"start": "16:30", "end": "16:45"}}', 'System-enforced break schedule');

-- Meeting validation data table
CREATE TABLE public.meeting_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  outcome TEXT NOT NULL,
  next_step TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Follow-up validation data table
CREATE TABLE public.followup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  followup_count INTEGER NOT NULL DEFAULT 0,
  remark TEXT,
  remark_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idle_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_logs ENABLE ROW LEVEL SECURITY;

-- Activity logs policies (immutable - no update/delete)
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Supervisors can view team activity logs"
  ON public.activity_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'supervisor') AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = activity_logs.user_id
        AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
      )
    )
  );

CREATE POLICY "Management can view all activity logs"
  ON public.activity_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'operations_head') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'super_admin')
  );

-- Attendance records policies
CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own attendance"
  ON public.attendance_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own attendance"
  ON public.attendance_records FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Supervisors can view team attendance"
  ON public.attendance_records FOR SELECT
  USING (
    has_role(auth.uid(), 'supervisor') AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = attendance_records.user_id
        AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
      )
    )
  );

CREATE POLICY "Management can view all attendance"
  ON public.attendance_records FOR SELECT
  USING (
    has_role(auth.uid(), 'operations_head') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'super_admin')
  );

-- Idle alerts policies
CREATE POLICY "Users can view own idle alerts"
  ON public.idle_alerts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert idle alerts"
  ON public.idle_alerts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can acknowledge own alerts"
  ON public.idle_alerts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Supervisors can view team idle alerts"
  ON public.idle_alerts FOR SELECT
  USING (
    has_role(auth.uid(), 'supervisor') AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = idle_alerts.user_id
        AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
      )
    )
  );

CREATE POLICY "Management can view all idle alerts"
  ON public.idle_alerts FOR SELECT
  USING (
    has_role(auth.uid(), 'operations_head') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'super_admin')
  );

-- Activity config policies (read for all, write for admins)
CREATE POLICY "Everyone can view config"
  ON public.activity_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage config"
  ON public.activity_config FOR ALL
  USING (
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'super_admin')
  );

-- Meeting logs policies
CREATE POLICY "Users can manage own meeting logs"
  ON public.meeting_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activity_logs al
      WHERE al.id = meeting_logs.activity_log_id
      AND al.user_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors can view team meeting logs"
  ON public.meeting_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_logs al
      JOIN profiles p ON p.id = al.user_id
      WHERE al.id = meeting_logs.activity_log_id
      AND has_role(auth.uid(), 'supervisor')
      AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
    )
  );

-- Follow-up logs policies
CREATE POLICY "Users can manage own followup logs"
  ON public.followup_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activity_logs al
      WHERE al.id = followup_logs.activity_log_id
      AND al.user_id = auth.uid()
    )
  );

CREATE POLICY "Supervisors can view team followup logs"
  ON public.followup_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_logs al
      JOIN profiles p ON p.id = al.user_id
      WHERE al.id = followup_logs.activity_log_id
      AND has_role(auth.uid(), 'supervisor')
      AND (p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid()))
    )
  );

-- Function to calculate daily score
CREATE OR REPLACE FUNCTION calculate_daily_score(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_work_minutes INTEGER;
  v_idle_count INTEGER;
  v_late BOOLEAN;
  v_score NUMERIC;
BEGIN
  -- Get attendance data
  SELECT total_work_minutes, is_late
  INTO v_work_minutes, v_late
  FROM attendance_records
  WHERE user_id = p_user_id AND date = p_date;
  
  -- Get idle incidents count
  SELECT COUNT(*)
  INTO v_idle_count
  FROM idle_alerts
  WHERE user_id = p_user_id
  AND alert_time::date = p_date
  AND severity = 'escalation';
  
  -- Base score calculation
  v_score := LEAST(100, (COALESCE(v_work_minutes, 0) / 360.0) * 100);
  
  -- Deduct for idle incidents
  v_score := v_score - (v_idle_count * 5);
  
  -- Deduct for late
  IF v_late THEN
    v_score := v_score - 5;
  END IF;
  
  RETURN GREATEST(0, v_score);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to close previous activity and start new one
CREATE OR REPLACE FUNCTION switch_activity(
  p_user_id UUID,
  p_activity_type activity_type,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE;
  v_new_log_id UUID;
  v_duration INTEGER;
BEGIN
  v_now := now();
  
  -- Close any open activity
  UPDATE activity_logs
  SET 
    ended_at = v_now,
    duration_minutes = EXTRACT(EPOCH FROM (v_now - started_at)) / 60
  WHERE user_id = p_user_id
    AND ended_at IS NULL;
  
  -- Insert new activity
  INSERT INTO activity_logs (user_id, activity_type, started_at, metadata)
  VALUES (p_user_id, p_activity_type, v_now, p_metadata)
  RETURNING id INTO v_new_log_id;
  
  RETURN v_new_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update attendance on activity log insert
CREATE OR REPLACE FUNCTION update_attendance_on_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_today DATE;
  v_work_start TIME;
  v_late_threshold INTEGER;
BEGIN
  v_today := (NEW.started_at AT TIME ZONE 'Asia/Dubai')::date;
  v_work_start := '10:00:00'::TIME;
  v_late_threshold := 5;
  
  -- Upsert attendance record
  INSERT INTO attendance_records (user_id, date, first_login, status, is_late, late_by_minutes)
  VALUES (
    NEW.user_id,
    v_today,
    NEW.started_at,
    CASE 
      WHEN (NEW.started_at AT TIME ZONE 'Asia/Dubai')::time > (v_work_start + (v_late_threshold || ' minutes')::interval) THEN 'late'::attendance_status
      ELSE 'present'::attendance_status
    END,
    (NEW.started_at AT TIME ZONE 'Asia/Dubai')::time > (v_work_start + (v_late_threshold || ' minutes')::interval),
    GREATEST(0, EXTRACT(EPOCH FROM ((NEW.started_at AT TIME ZONE 'Asia/Dubai')::time - v_work_start)) / 60)::INTEGER
  )
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_attendance_on_activity
  AFTER INSERT ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_on_activity();

-- Enable realtime for activity monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.idle_alerts;