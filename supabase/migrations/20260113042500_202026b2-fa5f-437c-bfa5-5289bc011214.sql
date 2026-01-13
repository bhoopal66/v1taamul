-- Create case management ENUM types
CREATE TYPE public.case_bank AS ENUM ('RAK', 'NBF', 'UBL', 'RUYA', 'MASHREQ', 'WIO');
CREATE TYPE public.case_status AS ENUM (
  'new',
  'document_collection', 
  'under_review',
  'submitted_to_bank',
  'bank_processing',
  'approved',
  'declined',
  'on_hold',
  'cancelled'
);
CREATE TYPE public.document_type AS ENUM (
  'trade_license',
  'emirates_id',
  'passport',
  'visa',
  'bank_statement',
  'financials',
  'moa',
  'power_of_attorney',
  'other'
);
CREATE TYPE public.follow_up_type AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'bank_visit', 'other');
CREATE TYPE public.audit_action AS ENUM (
  'case_created',
  'status_changed',
  'document_uploaded',
  'document_verified',
  'note_added',
  'follow_up_scheduled',
  'follow_up_completed',
  'assigned',
  'reassigned'
);

-- Create cases table
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.master_contacts(id) ON DELETE RESTRICT NOT NULL,
  coordinator_id UUID NOT NULL,
  original_agent_id UUID NOT NULL,
  bank case_bank NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('account', 'loan')),
  status case_status NOT NULL DEFAULT 'new',
  priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
  deal_value NUMERIC(12,2),
  notes TEXT,
  internal_notes TEXT,
  expected_completion_date DATE,
  actual_completion_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create case_documents table
CREATE TABLE public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create follow_ups table
CREATE TABLE public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  follow_up_type follow_up_type NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  outcome TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create case_audit_trail table
CREATE TABLE public.case_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  action audit_action NOT NULL,
  performed_by UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create banker_contacts table
CREATE TABLE public.banker_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank case_bank NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create document_templates table
CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank case_bank NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('account', 'loan')),
  document_type document_type NOT NULL,
  is_required BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add max_case_capacity to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_case_capacity INTEGER DEFAULT 50;

-- Enable RLS on all tables
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banker_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is a coordinator
CREATE OR REPLACE FUNCTION public.is_coordinator(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = is_coordinator.user_id
      AND role = 'coordinator'
  )
$$;

-- Generate case number function
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  next_num INTEGER;
  case_num TEXT;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 4) AS INTEGER)), 0) + 1 
  INTO next_num 
  FROM public.cases 
  WHERE case_number LIKE year_prefix || '-%';
  case_num := year_prefix || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN case_num;
END;
$$;

-- RLS Policies for cases
CREATE POLICY "Coordinators can view assigned cases"
ON public.cases FOR SELECT
USING (
  coordinator_id = auth.uid() OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Coordinators can insert cases"
ON public.cases FOR INSERT
WITH CHECK (
  is_coordinator(auth.uid()) OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Coordinators can update assigned cases"
ON public.cases FOR UPDATE
USING (
  coordinator_id = auth.uid() OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

-- RLS Policies for case_documents
CREATE POLICY "Coordinators can view case documents"
ON public.case_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = case_documents.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

CREATE POLICY "Coordinators can upload documents"
ON public.case_documents FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = case_documents.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

CREATE POLICY "Coordinators can update documents"
ON public.case_documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = case_documents.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

-- RLS Policies for follow_ups
CREATE POLICY "Coordinators can view follow ups"
ON public.follow_ups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = follow_ups.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

CREATE POLICY "Coordinators can create follow ups"
ON public.follow_ups FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = follow_ups.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

CREATE POLICY "Coordinators can update follow ups"
ON public.follow_ups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = follow_ups.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

-- RLS Policies for case_audit_trail
CREATE POLICY "Coordinators can view audit trail"
ON public.case_audit_trail FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = case_audit_trail.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

CREATE POLICY "System can insert audit records"
ON public.case_audit_trail FOR INSERT
WITH CHECK (
  performed_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.cases 
    WHERE cases.id = case_audit_trail.case_id 
    AND (cases.coordinator_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

-- RLS Policies for banker_contacts
CREATE POLICY "Coordinators can view banker contacts"
ON public.banker_contacts FOR SELECT
USING (
  is_coordinator(auth.uid()) OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Coordinators can manage banker contacts"
ON public.banker_contacts FOR ALL
USING (
  is_coordinator(auth.uid()) OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

-- RLS Policies for document_templates (read-only for coordinators)
CREATE POLICY "Everyone can view document templates"
ON public.document_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage document templates"
ON public.document_templates FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

-- Create trigger for updated_at on cases
CREATE TRIGGER update_cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on banker_contacts
CREATE TRIGGER update_banker_contacts_updated_at
BEFORE UPDATE ON public.banker_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_cases_coordinator ON public.cases(coordinator_id);
CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_bank ON public.cases(bank);
CREATE INDEX idx_cases_created_at ON public.cases(created_at DESC);
CREATE INDEX idx_case_documents_case ON public.case_documents(case_id);
CREATE INDEX idx_follow_ups_case ON public.follow_ups(case_id);
CREATE INDEX idx_follow_ups_scheduled ON public.follow_ups(scheduled_at);
CREATE INDEX idx_audit_trail_case ON public.case_audit_trail(case_id);