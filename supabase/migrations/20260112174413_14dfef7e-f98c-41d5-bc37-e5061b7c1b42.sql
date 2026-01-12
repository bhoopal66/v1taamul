-- Create table for tracking lead stage transitions
CREATE TABLE public.lead_stage_transitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_status public.lead_status,
  to_status public.lead_status NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_lead_stage_transitions_lead_id ON public.lead_stage_transitions(lead_id);
CREATE INDEX idx_lead_stage_transitions_changed_at ON public.lead_stage_transitions(changed_at DESC);

-- Enable RLS
ALTER TABLE public.lead_stage_transitions ENABLE ROW LEVEL SECURITY;

-- RLS policies - agents can see transitions for their own leads
CREATE POLICY "Users can view transitions for their leads"
ON public.lead_stage_transitions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_stage_transitions.lead_id
    AND leads.agent_id = auth.uid()
  )
);

CREATE POLICY "Users can insert transitions for their leads"
ON public.lead_stage_transitions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_stage_transitions.lead_id
    AND leads.agent_id = auth.uid()
  )
);

-- Create function to automatically track stage transitions
CREATE OR REPLACE FUNCTION public.track_lead_stage_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if lead_status actually changed
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    INSERT INTO public.lead_stage_transitions (
      lead_id,
      from_status,
      to_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.lead_status,
      NEW.lead_status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on leads table
CREATE TRIGGER track_lead_stage_change
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_lead_stage_transition();

-- Also track initial lead creation
CREATE OR REPLACE FUNCTION public.track_lead_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.lead_stage_transitions (
    lead_id,
    from_status,
    to_status,
    changed_by
  ) VALUES (
    NEW.id,
    NULL,
    NEW.lead_status,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER track_lead_creation
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_lead_creation();