-- Create WhatsApp message templates table
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'follow_up',
  content TEXT NOT NULL,
  placeholders TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Templates policies - all agents can view active templates
CREATE POLICY "All authenticated can view active templates" 
ON public.whatsapp_templates 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Supervisors can manage templates
CREATE POLICY "Supervisors can manage templates" 
ON public.whatsapp_templates 
FOR ALL 
USING (
  has_role(auth.uid(), 'supervisor'::app_role) 
  OR has_role(auth.uid(), 'operations_head'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create updated_at trigger for templates
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();