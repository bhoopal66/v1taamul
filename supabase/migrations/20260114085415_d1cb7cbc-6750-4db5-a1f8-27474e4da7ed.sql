-- Add callback_datetime column to call_feedback table
ALTER TABLE public.call_feedback 
ADD COLUMN callback_datetime TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of upcoming callbacks
CREATE INDEX idx_call_feedback_callback_datetime 
ON public.call_feedback (callback_datetime) 
WHERE callback_datetime IS NOT NULL AND feedback_status = 'callback';