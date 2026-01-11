-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the edge function
CREATE OR REPLACE FUNCTION public.trigger_performance_check()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get the Supabase URL from environment (this will be the edge function URL)
  edge_function_url := 'https://eoendveneygjkciuhfaw.supabase.co/functions/v1/check-performance-alerts';
  
  -- Make HTTP request to the edge function
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule the cron job to run every hour at minute 0
-- The cron expression '0 * * * *' means: at minute 0 of every hour
SELECT cron.schedule(
  'check-performance-alerts-hourly',
  '0 * * * *',
  $$SELECT public.trigger_performance_check()$$
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;