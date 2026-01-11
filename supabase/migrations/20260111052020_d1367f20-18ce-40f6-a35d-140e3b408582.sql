-- Create enum for alert types
CREATE TYPE public.alert_type AS ENUM ('team', 'agent');

-- Create enum for alert status
CREATE TYPE public.alert_status AS ENUM ('active', 'acknowledged', 'resolved');

-- Create performance_targets table
CREATE TABLE public.performance_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type alert_type NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  metric TEXT NOT NULL, -- e.g., 'calls', 'leads', 'conversion_rate'
  target_value NUMERIC NOT NULL,
  threshold_percentage NUMERIC NOT NULL DEFAULT 80, -- Alert when below this % of target
  period TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_target CHECK (
    (target_type = 'team' AND team_id IS NOT NULL AND agent_id IS NULL) OR
    (target_type = 'agent' AND agent_id IS NOT NULL AND team_id IS NULL)
  )
);

-- Create performance_alerts table
CREATE TABLE public.performance_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_id UUID NOT NULL REFERENCES public.performance_targets(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  percentage_achieved NUMERIC NOT NULL,
  alert_status alert_status NOT NULL DEFAULT 'active',
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for performance_targets
-- Admins can do everything
CREATE POLICY "Admins can manage performance targets"
ON public.performance_targets
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Team leaders can view their team targets
CREATE POLICY "Team leaders can view own team targets"
ON public.performance_targets
FOR SELECT
TO authenticated
USING (
  target_type = 'team' AND 
  team_id IN (SELECT id FROM public.teams WHERE leader_id = auth.uid())
);

-- Agents can view their own targets
CREATE POLICY "Agents can view own targets"
ON public.performance_targets
FOR SELECT
TO authenticated
USING (target_type = 'agent' AND agent_id = auth.uid());

-- RLS policies for performance_alerts
-- Admins can view all alerts
CREATE POLICY "Admins can manage performance alerts"
ON public.performance_alerts
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Team leaders can view and acknowledge their team alerts
CREATE POLICY "Team leaders can view team alerts"
ON public.performance_alerts
FOR SELECT
TO authenticated
USING (
  alert_type = 'team' AND 
  team_id IN (SELECT id FROM public.teams WHERE leader_id = auth.uid())
);

CREATE POLICY "Team leaders can update team alerts"
ON public.performance_alerts
FOR UPDATE
TO authenticated
USING (
  alert_type = 'team' AND 
  team_id IN (SELECT id FROM public.teams WHERE leader_id = auth.uid())
);

-- Agents can view and acknowledge their own alerts
CREATE POLICY "Agents can view own alerts"
ON public.performance_alerts
FOR SELECT
TO authenticated
USING (alert_type = 'agent' AND agent_id = auth.uid());

CREATE POLICY "Agents can update own alerts"
ON public.performance_alerts
FOR UPDATE
TO authenticated
USING (alert_type = 'agent' AND agent_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_performance_targets_updated_at
  BEFORE UPDATE ON public.performance_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_performance_alerts_updated_at
  BEFORE UPDATE ON public.performance_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();