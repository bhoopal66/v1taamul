-- Create role enum for users
CREATE TYPE public.app_role AS ENUM ('agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller');

-- Create status enums
CREATE TYPE public.contact_status AS ENUM ('new', 'contacted', 'interested', 'not_interested', 'converted');
CREATE TYPE public.feedback_status AS ENUM ('not_answered', 'interested', 'not_interested', 'callback', 'wrong_number');
CREATE TYPE public.action_type AS ENUM ('upload', 'call', 'feedback', 'reassign', 'status_change');
CREATE TYPE public.upload_status AS ENUM ('pending', 'approved', 'rejected', 'supplemented');
CREATE TYPE public.call_status AS ENUM ('pending', 'called', 'skipped');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.delivery_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- 1. Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) NOT NULL,
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    whatsapp_number VARCHAR(20),
    supervisor_id UUID REFERENCES public.profiles(id),
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Roles table (separate for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- 3. Master Contacts table
CREATE TABLE public.master_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_license_number VARCHAR(50) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    contact_person_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    city VARCHAR(100),
    first_upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_uploaded_by UUID REFERENCES auth.users(id),
    status contact_status DEFAULT 'new',
    current_owner_agent_id UUID REFERENCES auth.users(id),
    ownership_lock_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Contact History table
CREATE TABLE public.contact_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.master_contacts(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES auth.users(id) NOT NULL,
    action_type action_type NOT NULL,
    action_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    feedback_status feedback_status,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Call Sheet Uploads table
CREATE TABLE public.call_sheet_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES auth.users(id) NOT NULL,
    upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file_name VARCHAR(255),
    file_size INTEGER,
    total_entries_submitted INTEGER DEFAULT 0,
    valid_entries INTEGER DEFAULT 0,
    invalid_entries INTEGER DEFAULT 0,
    duplicate_entries INTEGER DEFAULT 0,
    approved_count INTEGER DEFAULT 0,
    rejected_count INTEGER DEFAULT 0,
    status upload_status DEFAULT 'pending',
    approval_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Upload Rejections table
CREATE TABLE public.upload_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.call_sheet_uploads(id) ON DELETE CASCADE NOT NULL,
    row_number INTEGER,
    company_name VARCHAR(255),
    phone_number VARCHAR(20),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Approved Call List table
CREATE TABLE public.approved_call_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.call_sheet_uploads(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.master_contacts(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES auth.users(id) NOT NULL,
    list_date DATE NOT NULL DEFAULT CURRENT_DATE,
    call_order INTEGER NOT NULL,
    call_status call_status DEFAULT 'pending',
    called_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Call Feedback table
CREATE TABLE public.call_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.master_contacts(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES auth.users(id) NOT NULL,
    call_list_id UUID REFERENCES public.approved_call_list(id),
    call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    feedback_status feedback_status NOT NULL,
    notes TEXT,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Leads table
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.master_contacts(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES auth.users(id) NOT NULL,
    qualified_date DATE DEFAULT CURRENT_DATE,
    lead_status lead_status DEFAULT 'new',
    lead_score INTEGER DEFAULT 0,
    expected_close_date DATE,
    deal_value DECIMAL(15, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. WhatsApp Messages table
CREATE TABLE public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES auth.users(id) NOT NULL,
    contact_id UUID REFERENCES public.master_contacts(id) ON DELETE CASCADE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    template_name VARCHAR(100),
    direction message_direction DEFAULT 'outbound',
    sent_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_status delivery_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Do Not Call List
CREATE TABLE public.do_not_call_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    reason TEXT,
    added_by UUID REFERENCES auth.users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Performance Cache (for dashboard speed)
CREATE TABLE public.performance_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES auth.users(id) NOT NULL,
    cache_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_calls INTEGER DEFAULT 0,
    interested_count INTEGER DEFAULT 0,
    not_interested_count INTEGER DEFAULT 0,
    not_answered_count INTEGER DEFAULT 0,
    leads_generated INTEGER DEFAULT 0,
    whatsapp_sent INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (agent_id, cache_date)
);

-- Create indexes for performance
CREATE INDEX idx_master_contacts_trade_license ON public.master_contacts(trade_license_number);
CREATE INDEX idx_master_contacts_phone ON public.master_contacts(phone_number);
CREATE INDEX idx_master_contacts_owner ON public.master_contacts(current_owner_agent_id);
CREATE INDEX idx_master_contacts_lock ON public.master_contacts(ownership_lock_until);
CREATE INDEX idx_approved_call_list_agent_date ON public.approved_call_list(agent_id, list_date);
CREATE INDEX idx_approved_call_list_status ON public.approved_call_list(call_status);
CREATE INDEX idx_call_feedback_agent ON public.call_feedback(agent_id);
CREATE INDEX idx_call_feedback_timestamp ON public.call_feedback(call_timestamp);
CREATE INDEX idx_performance_cache_agent_date ON public.performance_cache(agent_id, cache_date);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sheet_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_call_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.do_not_call_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_cache ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
    
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
    
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Supervisors can view team profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.id = public.profiles.supervisor_id
        )
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
        OR public.has_role(auth.uid(), 'admin')
    );

-- User Roles RLS policies
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Master Contacts RLS policies
CREATE POLICY "Agents can view owned contacts" ON public.master_contacts
    FOR SELECT USING (
        current_owner_agent_id = auth.uid()
        OR first_uploaded_by = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
        OR public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Agents can insert contacts" ON public.master_contacts
    FOR INSERT WITH CHECK (first_uploaded_by = auth.uid());

CREATE POLICY "Agents can update owned contacts" ON public.master_contacts
    FOR UPDATE USING (
        current_owner_agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

-- Contact History RLS policies
CREATE POLICY "Users can view relevant history" ON public.contact_history
    FOR SELECT USING (
        agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
        OR public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "Users can insert own history" ON public.contact_history
    FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Call Sheet Uploads RLS policies
CREATE POLICY "Agents can view own uploads" ON public.call_sheet_uploads
    FOR SELECT USING (
        agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

CREATE POLICY "Agents can insert uploads" ON public.call_sheet_uploads
    FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Upload Rejections RLS policies
CREATE POLICY "Users can view rejections" ON public.upload_rejections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.call_sheet_uploads u 
            WHERE u.id = upload_id AND u.agent_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

CREATE POLICY "System can insert rejections" ON public.upload_rejections
    FOR INSERT WITH CHECK (true);

-- Approved Call List RLS policies
CREATE POLICY "Agents can view own call list" ON public.approved_call_list
    FOR SELECT USING (
        agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

CREATE POLICY "Agents can update own call list" ON public.approved_call_list
    FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "System can insert call list" ON public.approved_call_list
    FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Call Feedback RLS policies
CREATE POLICY "Users can view feedback" ON public.call_feedback
    FOR SELECT USING (
        agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

CREATE POLICY "Agents can insert feedback" ON public.call_feedback
    FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Leads RLS policies
CREATE POLICY "Users can view leads" ON public.leads
    FOR SELECT USING (
        agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

CREATE POLICY "Agents can insert leads" ON public.leads
    FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own leads" ON public.leads
    FOR UPDATE USING (agent_id = auth.uid());

-- WhatsApp Messages RLS policies
CREATE POLICY "Users can view messages" ON public.whatsapp_messages
    FOR SELECT USING (
        agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

CREATE POLICY "Agents can insert messages" ON public.whatsapp_messages
    FOR INSERT WITH CHECK (agent_id = auth.uid());

-- Do Not Call List RLS policies
CREATE POLICY "All authenticated can view DNC" ON public.do_not_call_list
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Supervisors can manage DNC" ON public.do_not_call_list
    FOR ALL USING (
        public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
        OR public.has_role(auth.uid(), 'admin')
    );

-- Performance Cache RLS policies
CREATE POLICY "Users can view own performance" ON public.performance_cache
    FOR SELECT USING (
        agent_id = auth.uid()
        OR public.has_role(auth.uid(), 'supervisor')
        OR public.has_role(auth.uid(), 'operations_head')
    );

CREATE POLICY "Users can manage own cache" ON public.performance_cache
    FOR ALL USING (agent_id = auth.uid());

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    
    -- Default role is agent
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'agent');
    
    RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_master_contacts_updated_at
    BEFORE UPDATE ON public.master_contacts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_performance_cache_updated_at
    BEFORE UPDATE ON public.performance_cache
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.approved_call_list;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_cache;