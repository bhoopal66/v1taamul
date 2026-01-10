-- Add lead_source column to leads table
ALTER TABLE public.leads 
ADD COLUMN lead_source TEXT DEFAULT 'cold_call';

-- Create index for better query performance on lead_source
CREATE INDEX idx_leads_lead_source ON public.leads(lead_source);

-- Add a comment to document the column
COMMENT ON COLUMN public.leads.lead_source IS 'Tracks the channel/source that generated this lead (e.g., cold_call, referral, website, social_media, event, inbound_call)';