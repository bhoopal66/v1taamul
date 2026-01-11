-- Create severity enum type
CREATE TYPE public.alert_severity AS ENUM ('warning', 'critical');

-- Add severity column to performance_alerts
ALTER TABLE public.performance_alerts 
ADD COLUMN severity public.alert_severity NOT NULL DEFAULT 'warning';

-- Update existing alerts based on percentage achieved
-- Critical: below 50% of target, Warning: 50-80% of target
UPDATE public.performance_alerts 
SET severity = CASE 
  WHEN percentage_achieved < 50 THEN 'critical'::public.alert_severity
  ELSE 'warning'::public.alert_severity
END;