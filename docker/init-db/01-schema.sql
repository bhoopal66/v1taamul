-- ============================================
-- Sales Performance Tracker - Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TEAMS
-- ============================================
CREATE TYPE team_type AS ENUM ('remote', 'office');

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    team_type team_type NOT NULL,
    leader_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROFILES (Users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone_number VARCHAR(50),
    whatsapp_number VARCHAR(50),
    team_id UUID REFERENCES teams(id),
    supervisor_id UUID REFERENCES profiles(id),
    is_active BOOLEAN DEFAULT true,
    login_streak_current INTEGER DEFAULT 0,
    login_streak_longest INTEGER DEFAULT 0,
    last_login TIMESTAMP WITH TIME ZONE,
    last_login_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for team leader
ALTER TABLE teams ADD CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES profiles(id);

-- ============================================
-- USER ROLES
-- ============================================
CREATE TYPE app_role AS ENUM ('agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller');

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    UNIQUE(user_id, role)
);

-- ============================================
-- USER SESSIONS (for express-session)
-- ============================================
CREATE TABLE user_sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_session_expire ON user_sessions(expire);

-- ============================================
-- MASTER CONTACTS
-- ============================================
CREATE TYPE contact_status AS ENUM ('new', 'contacted', 'interested', 'not_interested', 'converted');

CREATE TABLE master_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    contact_person_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    trade_license_number VARCHAR(100) NOT NULL,
    area VARCHAR(255),
    city VARCHAR(255),
    industry VARCHAR(255),
    status contact_status DEFAULT 'new',
    current_owner_agent_id UUID REFERENCES profiles(id),
    first_uploaded_by UUID REFERENCES profiles(id),
    first_upload_date TIMESTAMP WITH TIME ZONE,
    in_company_pool BOOLEAN DEFAULT false,
    pool_entry_date TIMESTAMP WITH TIME ZONE,
    ownership_lock_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CALL SHEET UPLOADS
-- ============================================
CREATE TYPE upload_status AS ENUM ('pending', 'approved', 'rejected', 'supplemented');

CREATE TABLE call_sheet_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    upload_date DATE DEFAULT CURRENT_DATE,
    file_name VARCHAR(255),
    file_size INTEGER,
    status upload_status DEFAULT 'pending',
    total_entries_submitted INTEGER,
    valid_entries INTEGER,
    invalid_entries INTEGER,
    duplicate_entries INTEGER,
    approved_count INTEGER,
    rejected_count INTEGER,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approval_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- APPROVED CALL LIST
-- ============================================
CREATE TYPE call_status AS ENUM ('pending', 'called', 'skipped');

CREATE TABLE approved_call_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    contact_id UUID NOT NULL REFERENCES master_contacts(id),
    upload_id UUID REFERENCES call_sheet_uploads(id),
    list_date DATE DEFAULT CURRENT_DATE,
    call_order INTEGER NOT NULL,
    call_status call_status DEFAULT 'pending',
    called_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CALL FEEDBACK
-- ============================================
CREATE TYPE feedback_status AS ENUM ('not_answered', 'interested', 'not_interested', 'callback', 'wrong_number');

CREATE TABLE call_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    contact_id UUID NOT NULL REFERENCES master_contacts(id),
    call_list_id UUID REFERENCES approved_call_list(id),
    feedback_status feedback_status NOT NULL,
    notes TEXT,
    whatsapp_sent BOOLEAN DEFAULT false,
    call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LEADS
-- ============================================
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    contact_id UUID NOT NULL REFERENCES master_contacts(id),
    lead_status lead_status DEFAULT 'new',
    lead_score INTEGER,
    lead_source VARCHAR(255),
    deal_value DECIMAL(12, 2),
    expected_close_date DATE,
    qualified_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AGENT SUBMISSIONS
-- ============================================
CREATE TYPE submission_group AS ENUM ('group1', 'group2');

CREATE TABLE agent_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    bank_name VARCHAR(255) NOT NULL,
    submission_group submission_group NOT NULL,
    submission_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    review_notes TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AGENT TALK TIME
-- ============================================
CREATE TABLE agent_talk_time (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    date DATE DEFAULT CURRENT_DATE,
    talk_time_minutes INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AGENT GOALS
-- ============================================
CREATE TABLE agent_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    goal_type VARCHAR(50) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    target_value INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PERFORMANCE TARGETS
-- ============================================
CREATE TYPE alert_type AS ENUM ('team', 'agent');

CREATE TABLE performance_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type alert_type NOT NULL,
    team_id UUID REFERENCES teams(id),
    agent_id UUID REFERENCES profiles(id),
    metric VARCHAR(100) NOT NULL,
    target_value INTEGER NOT NULL,
    threshold_percentage INTEGER DEFAULT 80,
    period VARCHAR(50) DEFAULT 'daily',
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PERFORMANCE ALERTS
-- ============================================
CREATE TYPE alert_severity AS ENUM ('warning', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved');

CREATE TABLE performance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id UUID NOT NULL REFERENCES performance_targets(id),
    alert_type alert_type NOT NULL,
    team_id UUID REFERENCES teams(id),
    agent_id UUID REFERENCES profiles(id),
    metric VARCHAR(100) NOT NULL,
    target_value INTEGER NOT NULL,
    actual_value INTEGER NOT NULL,
    percentage_achieved INTEGER NOT NULL,
    severity alert_severity DEFAULT 'warning',
    alert_status alert_status DEFAULT 'active',
    message TEXT,
    acknowledged_by UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PERFORMANCE CACHE
-- ============================================
CREATE TABLE performance_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    cache_date DATE DEFAULT CURRENT_DATE,
    total_calls INTEGER DEFAULT 0,
    interested_count INTEGER DEFAULT 0,
    not_interested_count INTEGER DEFAULT 0,
    not_answered_count INTEGER DEFAULT 0,
    leads_generated INTEGER DEFAULT 0,
    whatsapp_sent INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- COACH CONVERSATIONS
-- ============================================
CREATE TABLE coach_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE coach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES coach_conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CONTACT HISTORY
-- ============================================
CREATE TYPE action_type AS ENUM ('upload', 'call', 'feedback', 'reassign', 'status_change');

CREATE TABLE contact_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES master_contacts(id),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    action_type action_type NOT NULL,
    action_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    feedback_status feedback_status,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DO NOT CALL LIST
-- ============================================
CREATE TABLE do_not_call_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    reason TEXT,
    added_by UUID REFERENCES profiles(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- UPLOAD REJECTIONS
-- ============================================
CREATE TABLE upload_rejections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID NOT NULL REFERENCES call_sheet_uploads(id) ON DELETE CASCADE,
    row_number INTEGER,
    company_name VARCHAR(255),
    phone_number VARCHAR(50),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- WHATSAPP TEMPLATES
-- ============================================
CREATE TABLE whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    placeholders TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- WHATSAPP MESSAGES
-- ============================================
CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES profiles(id),
    contact_id UUID NOT NULL REFERENCES master_contacts(id),
    phone_number VARCHAR(50) NOT NULL,
    message_content TEXT NOT NULL,
    template_name VARCHAR(255),
    direction message_direction DEFAULT 'outbound',
    delivery_status delivery_status DEFAULT 'pending',
    sent_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SCHEDULED REPORTS
-- ============================================
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID NOT NULL REFERENCES profiles(id),
    report_type VARCHAR(100) DEFAULT 'performance',
    frequency VARCHAR(50) DEFAULT 'weekly',
    schedule_day INTEGER DEFAULT 1,
    schedule_time TIME DEFAULT '09:00',
    recipients JSONB DEFAULT '[]',
    include_team_summary BOOLEAN DEFAULT true,
    include_agent_breakdown BOOLEAN DEFAULT true,
    include_alerts_summary BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_team_id ON profiles(team_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_master_contacts_owner ON master_contacts(current_owner_agent_id);
CREATE INDEX idx_master_contacts_phone ON master_contacts(phone_number);
CREATE INDEX idx_call_feedback_agent ON call_feedback(agent_id);
CREATE INDEX idx_call_feedback_date ON call_feedback(call_timestamp);
CREATE INDEX idx_leads_agent ON leads(agent_id);
CREATE INDEX idx_leads_status ON leads(lead_status);
CREATE INDEX idx_submissions_agent ON agent_submissions(agent_id);
CREATE INDEX idx_submissions_date ON agent_submissions(submission_date);
CREATE INDEX idx_talk_time_agent_date ON agent_talk_time(agent_id, date);
CREATE INDEX idx_goals_agent ON agent_goals(agent_id);
CREATE INDEX idx_performance_cache_agent_date ON performance_cache(agent_id, cache_date);
CREATE INDEX idx_coach_conversations_agent ON coach_conversations(agent_id);
CREATE INDEX idx_coach_messages_conversation ON coach_messages(conversation_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get user role function
CREATE OR REPLACE FUNCTION get_user_role(_user_id UUID)
RETURNS app_role AS $$
DECLARE
    user_role app_role;
BEGIN
    SELECT role INTO user_role FROM user_roles WHERE user_id = _user_id LIMIT 1;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON agent_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON agent_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_targets_updated_at BEFORE UPDATE ON performance_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON performance_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coach_conversations_updated_at BEFORE UPDATE ON coach_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

RAISE NOTICE 'Database schema created successfully!';
