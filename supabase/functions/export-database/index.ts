import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user has super_admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData || roleData.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Only super_admin can export the database" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Complete database export initiated by super_admin: ${user.id}`);

    const exportDate = new Date().toISOString();
    let sqlContent = `-- ================================================================
-- COMPLETE DATABASE EXPORT FOR ON-PREMISES MIGRATION
-- ================================================================
-- Generated: ${exportDate}
-- Exported by: ${user.email}
-- 
-- WARNING: This file contains sensitive data including:
-- - User credentials (hashed passwords)
-- - Personal information
-- - Business data
-- Store this file securely and delete after migration!
--
-- INSTRUCTIONS FOR ON-PREMISES SETUP:
-- 1. Install PostgreSQL 15+ with required extensions
-- 2. Install Supabase locally: https://supabase.com/docs/guides/self-hosting
-- 3. Run this SQL file against your database
-- 4. Update your frontend .env to point to your local Supabase URL
-- 5. Deploy edge functions to your local Supabase instance
-- ================================================================

`;

    // ========== SECTION 1: EXTENSIONS ==========
    sqlContent += `-- ================================================================
-- SECTION 1: REQUIRED EXTENSIONS
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";
CREATE EXTENSION IF NOT EXISTS "pg_net";

`;

    // ========== SECTION 2: CUSTOM ENUMS ==========
    sqlContent += `-- ================================================================
-- SECTION 2: CUSTOM ENUM TYPES
-- ================================================================
-- Drop existing enums if they exist (for clean reinstall)
DO $$ BEGIN
  DROP TYPE IF EXISTS public.app_role CASCADE;
  DROP TYPE IF EXISTS public.activity_type CASCADE;
  DROP TYPE IF EXISTS public.attendance_status CASCADE;
  DROP TYPE IF EXISTS public.contact_status CASCADE;
  DROP TYPE IF EXISTS public.upload_status CASCADE;
  DROP TYPE IF EXISTS public.call_status CASCADE;
  DROP TYPE IF EXISTS public.feedback_status CASCADE;
  DROP TYPE IF EXISTS public.action_type CASCADE;
  DROP TYPE IF EXISTS public.lead_status CASCADE;
  DROP TYPE IF EXISTS public.case_status CASCADE;
  DROP TYPE IF EXISTS public.case_bank CASCADE;
  DROP TYPE IF EXISTS public.document_type CASCADE;
  DROP TYPE IF EXISTS public.follow_up_type CASCADE;
  DROP TYPE IF EXISTS public.audit_action CASCADE;
  DROP TYPE IF EXISTS public.alert_type CASCADE;
  DROP TYPE IF EXISTS public.alert_status CASCADE;
  DROP TYPE IF EXISTS public.alert_severity CASCADE;
  DROP TYPE IF EXISTS public.idle_alert_severity CASCADE;
  DROP TYPE IF EXISTS public.team_type CASCADE;
  DROP TYPE IF EXISTS public.submission_group CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('agent', 'supervisor', 'operations_head', 'coordinator', 'admin', 'super_admin');
CREATE TYPE public.activity_type AS ENUM ('calling', 'break', 'lunch', 'meeting', 'training', 'followup', 'others', 'idle');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'leave');
CREATE TYPE public.contact_status AS ENUM ('new', 'contacted', 'interested', 'not_interested', 'callback', 'converted', 'dnc');
CREATE TYPE public.upload_status AS ENUM ('pending', 'approved', 'rejected', 'partial');
CREATE TYPE public.call_status AS ENUM ('pending', 'completed', 'skipped');
CREATE TYPE public.feedback_status AS ENUM ('interested', 'not_interested', 'callback', 'not_answered', 'wrong_number', 'already_have', 'switched_off', 'busy');
CREATE TYPE public.action_type AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'note');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
CREATE TYPE public.case_status AS ENUM ('new', 'documents_pending', 'documents_submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'closed', 'on_hold');
CREATE TYPE public.case_bank AS ENUM ('NBF', 'UBL', 'RAK', 'Mashreq', 'WIO', 'RUYA', 'Other');
CREATE TYPE public.document_type AS ENUM ('trade_license', 'emirates_id', 'passport', 'bank_statement', 'vat_certificate', 'moa', 'aoa', 'power_of_attorney', 'salary_certificate', 'other');
CREATE TYPE public.follow_up_type AS ENUM ('call', 'email', 'meeting', 'document_collection', 'bank_visit', 'other');
CREATE TYPE public.audit_action AS ENUM ('created', 'status_changed', 'document_uploaded', 'document_verified', 'note_added', 'assigned', 'priority_changed');
CREATE TYPE public.alert_type AS ENUM ('team', 'agent');
CREATE TYPE public.alert_status AS ENUM ('active', 'acknowledged', 'resolved');
CREATE TYPE public.alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.idle_alert_severity AS ENUM ('warning', 'escalation');
CREATE TYPE public.team_type AS ENUM ('sales', 'coordination', 'support');
CREATE TYPE public.submission_group AS ENUM ('group1', 'group2');

`;

    // ========== SECTION 3: TABLE DEFINITIONS ==========
    sqlContent += `-- ================================================================
-- SECTION 3: TABLE DEFINITIONS
-- ================================================================

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team_type public.team_type NOT NULL,
  leader_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  full_name VARCHAR,
  phone_number VARCHAR,
  whatsapp_number VARCHAR,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  team_id UUID REFERENCES public.teams(id),
  supervisor_id UUID REFERENCES public.profiles(id),
  login_streak_current INTEGER DEFAULT 0,
  login_streak_longest INTEGER DEFAULT 0,
  last_login_date DATE,
  last_login TIMESTAMPTZ,
  max_case_capacity INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key for teams.leader_id after profiles exists
ALTER TABLE public.teams ADD CONSTRAINT teams_leader_id_fkey 
  FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- User roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Activity config table
CREATE TABLE IF NOT EXISTS public.activity_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity sessions table
CREATE TABLE IF NOT EXISTS public.activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false,
  current_activity TEXT,
  current_activity_started_at TIMESTAMPTZ,
  total_others_minutes INTEGER DEFAULT 0,
  missed_confirmations INTEGER DEFAULT 0,
  last_confirmation_at TIMESTAMPTZ,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  activity_type public.activity_type NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  is_system_enforced BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  activity_details TEXT,
  confirmed_at TIMESTAMPTZ,
  confirmation_status TEXT,
  auto_switch_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity confirmations table
CREATE TABLE IF NOT EXISTS public.activity_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.activity_sessions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  prompted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  response_type TEXT,
  activity_before TEXT,
  activity_after TEXT,
  auto_switch_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance records table
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status DEFAULT 'present',
  first_login TIMESTAMPTZ,
  last_logout TIMESTAMPTZ,
  start_button_pressed_at TIMESTAMPTZ,
  is_working BOOLEAN DEFAULT false,
  is_late BOOLEAN DEFAULT false,
  late_by_minutes INTEGER DEFAULT 0,
  total_work_minutes INTEGER DEFAULT 0,
  total_break_minutes INTEGER DEFAULT 0,
  daily_score NUMERIC,
  missed_confirmations INTEGER DEFAULT 0,
  last_confirmation_at TIMESTAMPTZ,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Agent goals table
CREATE TABLE IF NOT EXISTS public.agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  goal_type TEXT NOT NULL,
  metric TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent submissions table
CREATE TABLE IF NOT EXISTS public.agent_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submission_group public.submission_group NOT NULL,
  bank_name TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent talk time table
CREATE TABLE IF NOT EXISTS public.agent_talk_time (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  talk_time_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, date)
);

-- Master contacts table
CREATE TABLE IF NOT EXISTS public.master_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR NOT NULL UNIQUE,
  company_name VARCHAR NOT NULL,
  contact_person_name VARCHAR DEFAULT '',
  industry VARCHAR,
  area VARCHAR,
  city VARCHAR,
  trade_license_number VARCHAR,
  status public.contact_status DEFAULT 'new',
  first_uploaded_by UUID,
  first_upload_date TIMESTAMPTZ DEFAULT now(),
  current_owner_agent_id UUID,
  ownership_lock_until DATE,
  in_company_pool BOOLEAN DEFAULT false,
  pool_entry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call sheet uploads table
CREATE TABLE IF NOT EXISTS public.call_sheet_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  upload_timestamp TIMESTAMPTZ DEFAULT now(),
  file_name VARCHAR,
  file_size INTEGER,
  total_entries_submitted INTEGER DEFAULT 0,
  valid_entries INTEGER DEFAULT 0,
  invalid_entries INTEGER DEFAULT 0,
  duplicate_entries INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  status public.upload_status DEFAULT 'pending',
  approval_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Approved call list table
CREATE TABLE IF NOT EXISTS public.approved_call_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES public.call_sheet_uploads(id),
  contact_id UUID NOT NULL REFERENCES public.master_contacts(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  list_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_order INTEGER NOT NULL,
  call_status public.call_status DEFAULT 'pending',
  called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Call feedback table
CREATE TABLE IF NOT EXISTS public.call_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.master_contacts(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  call_list_id UUID REFERENCES public.approved_call_list(id),
  call_timestamp TIMESTAMPTZ DEFAULT now(),
  feedback_status public.feedback_status NOT NULL,
  callback_datetime TIMESTAMPTZ,
  notes TEXT,
  whatsapp_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contact history table
CREATE TABLE IF NOT EXISTS public.contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.master_contacts(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  action_type public.action_type NOT NULL,
  action_date TIMESTAMPTZ DEFAULT now(),
  feedback_status public.feedback_status,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.master_contacts(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  lead_status public.lead_status DEFAULT 'new',
  lead_source TEXT DEFAULT 'cold_call',
  lead_score INTEGER DEFAULT 0,
  qualified_date DATE DEFAULT CURRENT_DATE,
  expected_close_date DATE,
  deal_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lead stage transitions table
CREATE TABLE IF NOT EXISTS public.lead_stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  from_status public.lead_status,
  to_status public.lead_status NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id),
  contact_id UUID NOT NULL REFERENCES public.master_contacts(id),
  coordinator_id UUID NOT NULL REFERENCES auth.users(id),
  original_agent_id UUID NOT NULL REFERENCES auth.users(id),
  bank public.case_bank NOT NULL,
  product_type TEXT NOT NULL,
  status public.case_status NOT NULL DEFAULT 'new',
  priority INTEGER DEFAULT 2,
  deal_value NUMERIC,
  expected_completion_date DATE,
  actual_completion_date DATE,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case audit trail table
CREATE TABLE IF NOT EXISTS public.case_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id),
  action public.audit_action NOT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case documents table
CREATE TABLE IF NOT EXISTS public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id),
  document_type public.document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow ups table
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id),
  follow_up_type public.follow_up_type NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Banker contacts table
CREATE TABLE IF NOT EXISTS public.banker_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank public.case_bank NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document templates table
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank public.case_bank NOT NULL,
  product_type TEXT NOT NULL,
  document_type public.document_type NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Do not call list table
CREATE TABLE IF NOT EXISTS public.do_not_call_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR NOT NULL UNIQUE,
  reason TEXT,
  added_by UUID,
  added_at TIMESTAMPTZ DEFAULT now()
);

-- Performance targets table
CREATE TABLE IF NOT EXISTS public.performance_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.alert_type NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  agent_id UUID REFERENCES public.profiles(id),
  metric TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily',
  target_value NUMERIC NOT NULL,
  threshold_percentage NUMERIC NOT NULL DEFAULT 80,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance alerts table
CREATE TABLE IF NOT EXISTS public.performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.performance_targets(id),
  alert_type public.alert_type NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  agent_id UUID REFERENCES public.profiles(id),
  metric TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  percentage_achieved NUMERIC NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'medium',
  alert_status public.alert_status NOT NULL DEFAULT 'active',
  message TEXT,
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance cache table
CREATE TABLE IF NOT EXISTS public.performance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  cache_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_calls INTEGER DEFAULT 0,
  interested_count INTEGER DEFAULT 0,
  not_interested_count INTEGER DEFAULT 0,
  not_answered_count INTEGER DEFAULT 0,
  whatsapp_sent INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, cache_date)
);

-- Scheduled reports table
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL DEFAULT 'weekly_performance',
  frequency TEXT NOT NULL DEFAULT 'weekly',
  schedule_day INTEGER NOT NULL DEFAULT 1,
  schedule_time TIME NOT NULL DEFAULT '08:00:00',
  recipients JSONB NOT NULL DEFAULT '[]',
  include_team_summary BOOLEAN NOT NULL DEFAULT true,
  include_agent_breakdown BOOLEAN NOT NULL DEFAULT true,
  include_alerts_summary BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supervisor alerts table
CREATE TABLE IF NOT EXISTS public.supervisor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES auth.users(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  agent_name TEXT,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  details JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idle alerts table
CREATE TABLE IF NOT EXISTS public.idle_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  alert_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  idle_duration_minutes INTEGER NOT NULL,
  severity public.idle_alert_severity NOT NULL,
  was_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  escalated_to UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coach conversations table
CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coach messages table
CREATE TABLE IF NOT EXISTS public.coach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.coach_conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upload processing logs table
CREATE TABLE IF NOT EXISTS public.upload_processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES public.call_sheet_uploads(id),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  session_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  log_entries JSONB NOT NULL DEFAULT '[]',
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upload rejections table
CREATE TABLE IF NOT EXISTS public.upload_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES public.call_sheet_uploads(id),
  row_number INTEGER,
  company_name VARCHAR,
  phone_number VARCHAR,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Followup logs table
CREATE TABLE IF NOT EXISTS public.followup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id),
  followup_count INTEGER NOT NULL DEFAULT 0,
  remark TEXT,
  remark_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meeting logs table
CREATE TABLE IF NOT EXISTS public.meeting_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id),
  client_name TEXT NOT NULL,
  outcome TEXT NOT NULL,
  next_step TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp templates table
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  category VARCHAR NOT NULL DEFAULT 'follow_up',
  content TEXT NOT NULL,
  placeholders TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

`;

    // ========== SECTION 4: DATABASE FUNCTIONS ==========
    sqlContent += `-- ================================================================
-- SECTION 4: DATABASE FUNCTIONS
-- ================================================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to get user's team ID
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT team_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- Function to get team ID that user leads
CREATE OR REPLACE FUNCTION public.get_led_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id
  FROM public.teams
  WHERE leader_id = _user_id
  LIMIT 1
$$;

-- Function to check if user is team leader
CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND leader_id = _user_id
  )
$$;

-- Function to check if user is coordinator
CREATE OR REPLACE FUNCTION public.is_coordinator(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = is_coordinator.user_id
      AND role = 'coordinator'
  )
$$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'agent');
    
    RETURN NEW;
END;
$$;

-- Function to update login streak
CREATE OR REPLACE FUNCTION public.update_login_streak(user_id uuid)
RETURNS TABLE(current_streak integer, longest_streak integer, streak_bonus_xp integer, is_new_day boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_login_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today DATE := CURRENT_DATE;
  v_is_new_day BOOLEAN := FALSE;
  v_bonus_xp INTEGER := 0;
BEGIN
  SELECT 
    p.last_login_date,
    COALESCE(p.login_streak_current, 0),
    COALESCE(p.login_streak_longest, 0)
  INTO v_last_login_date, v_current_streak, v_longest_streak
  FROM profiles p
  WHERE p.id = user_id;

  IF v_last_login_date IS NULL OR v_last_login_date < v_today THEN
    v_is_new_day := TRUE;
    
    IF v_last_login_date = v_today - INTERVAL '1 day' THEN
      v_current_streak := v_current_streak + 1;
    ELSIF v_last_login_date IS NULL OR v_last_login_date < v_today - INTERVAL '1 day' THEN
      v_current_streak := 1;
    END IF;

    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;

    v_bonus_xp := 10;
    IF v_current_streak >= 7 THEN v_bonus_xp := v_bonus_xp + 5; END IF;
    IF v_current_streak >= 30 THEN v_bonus_xp := v_bonus_xp + 10; END IF;
    IF v_current_streak >= 100 THEN v_bonus_xp := v_bonus_xp + 25; END IF;

    UPDATE profiles
    SET 
      last_login_date = v_today,
      last_login = NOW(),
      login_streak_current = v_current_streak,
      login_streak_longest = v_longest_streak,
      updated_at = NOW()
    WHERE id = user_id;
  END IF;

  RETURN QUERY SELECT v_current_streak, v_longest_streak, v_bonus_xp, v_is_new_day;
END;
$$;

-- Function to generate case number
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Function to check DNC list
CREATE OR REPLACE FUNCTION public.check_dnc(phone_to_check text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM do_not_call_list 
    WHERE phone_number = phone_to_check
  )
$$;

-- Function to find contact by phone
CREATE OR REPLACE FUNCTION public.find_contact_by_phone(phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  contact_id uuid;
BEGIN
  SELECT id INTO contact_id
  FROM master_contacts
  WHERE phone_number = phone
  LIMIT 1;
  
  RETURN contact_id;
END;
$$;

-- Function to track lead stage transition
CREATE OR REPLACE FUNCTION public.track_lead_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    INSERT INTO public.lead_stage_transitions (
      lead_id, from_status, to_status, changed_by
    ) VALUES (
      NEW.id, OLD.lead_status, NEW.lead_status, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Function to track lead creation
CREATE OR REPLACE FUNCTION public.track_lead_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.lead_stage_transitions (
    lead_id, from_status, to_status, changed_by
  ) VALUES (
    NEW.id, NULL, NEW.lead_status, auth.uid()
  );
  RETURN NEW;
END;
$$;

`;

    // ========== SECTION 5: TRIGGERS ==========
    sqlContent += `-- ================================================================
-- SECTION 5: TRIGGERS
-- ================================================================

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activity_sessions_updated_at BEFORE UPDATE ON public.activity_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lead tracking triggers
CREATE TRIGGER track_lead_status_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.track_lead_stage_transition();

CREATE TRIGGER track_lead_created
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.track_lead_creation();

`;

    // ========== SECTION 6: ROW LEVEL SECURITY POLICIES ==========
    sqlContent += `-- ================================================================
-- SECTION 6: ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_talk_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sheet_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_call_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banker_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.do_not_call_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idle_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- User Roles policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Profiles policies
CREATE POLICY "Users can view own full profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Management can view all profiles" ON public.profiles
  FOR SELECT USING (
    has_role(auth.uid(), 'operations_head') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Team leaders can view their team members" ON public.profiles
  FOR SELECT USING (
    (team_id = get_led_team_id(auth.uid())) AND (get_led_team_id(auth.uid()) IS NOT NULL)
  );

CREATE POLICY "Supervisors can view team member profiles" ON public.profiles
  FOR SELECT USING (
    has_role(auth.uid(), 'supervisor') AND (
      supervisor_id = auth.uid() OR 
      team_id IN (SELECT id FROM teams WHERE leader_id = auth.uid())
    )
  );

CREATE POLICY "Supervisors can view direct reports" ON public.profiles
  FOR SELECT USING (supervisor_id = auth.uid());

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Teams policies
CREATE POLICY "Users can view their own team" ON public.teams
  FOR SELECT USING (
    id = get_user_team_id(auth.uid()) OR 
    leader_id = auth.uid() OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admins can create teams" ON public.teams
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update teams" ON public.teams
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete teams" ON public.teams
  FOR DELETE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Activity logs policies
CREATE POLICY "Users can view own activity logs" ON public.activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Supervisors can view team activity logs" ON public.activity_logs
  FOR SELECT USING (
    has_role(auth.uid(), 'supervisor') AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = activity_logs.user_id AND (
        p.supervisor_id = auth.uid() OR p.team_id = get_led_team_id(auth.uid())
      )
    )
  );

CREATE POLICY "Management can view all activity logs" ON public.activity_logs
  FOR SELECT USING (
    has_role(auth.uid(), 'operations_head') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'super_admin')
  );

-- Call feedback policies
CREATE POLICY "Agents can insert feedback" ON public.call_feedback
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Users can view feedback" ON public.call_feedback
  FOR SELECT USING (
    agent_id = auth.uid() OR 
    has_role(auth.uid(), 'supervisor') OR 
    has_role(auth.uid(), 'operations_head')
  );

-- Leads policies
CREATE POLICY "Agents can insert leads" ON public.leads
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own leads" ON public.leads
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY "Users can view leads" ON public.leads
  FOR SELECT USING (
    agent_id = auth.uid() OR 
    has_role(auth.uid(), 'supervisor') OR 
    has_role(auth.uid(), 'operations_head') OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'super_admin')
  );

-- Add more policies as needed (this covers the critical ones)

`;

    // ========== SECTION 7: AUTH USERS DATA ==========
    sqlContent += `-- ================================================================
-- SECTION 7: AUTH.USERS DATA
-- ================================================================
-- WARNING: Contains hashed passwords. Users may need to reset passwords.

`;

    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error("Error fetching auth users:", authError.message);
        sqlContent += `-- Error fetching auth.users: ${authError.message}\n\n`;
      } else if (authUsers && authUsers.users && authUsers.users.length > 0) {
        sqlContent += `-- Total auth users: ${authUsers.users.length}\n\n`;

        for (const authUser of authUsers.users) {
          const userData: Record<string, unknown> = {
            instance_id: '00000000-0000-0000-0000-000000000000',
            id: authUser.id,
            aud: authUser.aud || 'authenticated',
            role: authUser.role || 'authenticated',
            email: authUser.email,
            encrypted_password: (authUser as any).encrypted_password || '',
            email_confirmed_at: authUser.email_confirmed_at,
            invited_at: (authUser as any).invited_at,
            confirmation_token: '',
            confirmation_sent_at: (authUser as any).confirmation_sent_at,
            recovery_token: '',
            recovery_sent_at: (authUser as any).recovery_sent_at,
            email_change_token_new: '',
            email_change: '',
            email_change_sent_at: null,
            last_sign_in_at: authUser.last_sign_in_at,
            raw_app_meta_data: authUser.app_metadata || {},
            raw_user_meta_data: authUser.user_metadata || {},
            is_super_admin: false,
            created_at: authUser.created_at,
            updated_at: authUser.updated_at,
            phone: authUser.phone,
            phone_confirmed_at: authUser.phone_confirmed_at,
            phone_change: '',
            phone_change_token: '',
            phone_change_sent_at: null,
            confirmed_at: authUser.confirmed_at,
            email_change_token_current: '',
            email_change_confirm_status: 0,
            banned_until: (authUser as any).banned_until,
            reauthentication_token: '',
            reauthentication_sent_at: null,
            is_sso_user: false,
            deleted_at: null,
          };

          const columns = Object.keys(userData);
          const values = columns.map(col => {
            const val = userData[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'number') return val.toString();
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          sqlContent += `-- User: ${authUser.email}\n`;
          sqlContent += `INSERT INTO auth.users (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`;
        }
        sqlContent += `\n`;
      }
    } catch (authExportError) {
      console.error("Error exporting auth users:", authExportError);
      sqlContent += `-- Error exporting auth users\n\n`;
    }

    // ========== SECTION 8: PUBLIC SCHEMA DATA ==========
    sqlContent += `-- ================================================================
-- SECTION 8: PUBLIC SCHEMA DATA
-- ================================================================

`;

    const tables = [
      'teams',
      'profiles',
      'user_roles',
      'activity_config',
      'activity_sessions',
      'activity_logs',
      'activity_confirmations',
      'attendance_records',
      'agent_goals',
      'agent_submissions',
      'agent_talk_time',
      'master_contacts',
      'call_sheet_uploads',
      'approved_call_list',
      'call_feedback',
      'contact_history',
      'leads',
      'lead_stage_transitions',
      'cases',
      'case_audit_trail',
      'case_documents',
      'follow_ups',
      'banker_contacts',
      'document_templates',
      'do_not_call_list',
      'performance_targets',
      'performance_alerts',
      'performance_cache',
      'scheduled_reports',
      'supervisor_alerts',
      'idle_alerts',
      'coach_conversations',
      'coach_messages',
      'upload_processing_logs',
      'upload_rejections',
      'followup_logs',
      'meeting_logs',
      'whatsapp_templates',
    ];

    for (const tableName of tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.error(`Error fetching ${tableName}:`, error.message);
          sqlContent += `-- Error fetching ${tableName}: ${error.message}\n\n`;
          continue;
        }

        if (!data || data.length === 0) {
          sqlContent += `-- Table: ${tableName} (no data)\n\n`;
          continue;
        }

        sqlContent += `-- Table: ${tableName} (${data.length} rows)\n`;

        for (const row of data) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'number') return val.toString();
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          sqlContent += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
        }

        sqlContent += `\n`;
      } catch (tableError) {
        console.error(`Error processing ${tableName}:`, tableError);
        sqlContent += `-- Error processing ${tableName}\n\n`;
      }
    }

    // ========== SECTION 9: STORAGE BUCKETS ==========
    sqlContent += `-- ================================================================
-- SECTION 9: STORAGE BUCKETS
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('case-documents', 'case-documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for case-documents bucket
CREATE POLICY "Coordinators can upload case documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'case-documents' AND
  (is_coordinator(auth.uid()) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Coordinators can view case documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'case-documents' AND
  (is_coordinator(auth.uid()) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
);

CREATE POLICY "Coordinators can delete case documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'case-documents' AND
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
);

`;

    // ========== SECTION 10: VIEWS ==========
    sqlContent += `-- ================================================================
-- SECTION 10: VIEWS
-- ================================================================

-- Public profiles view (non-sensitive data only)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id, username, full_name, avatar_url, is_active,
  team_id, supervisor_id, login_streak_current, login_streak_longest,
  last_login_date, created_at, updated_at
FROM public.profiles;

-- Secure profiles view (includes sensitive data, for authorized users)
CREATE OR REPLACE VIEW public.profiles_secure AS
SELECT 
  id, username, full_name, email, phone_number, whatsapp_number,
  avatar_url, is_active, team_id, supervisor_id,
  login_streak_current, login_streak_longest, last_login_date,
  last_login, created_at, updated_at
FROM public.profiles;

`;

    // ========== FINAL SECTION ==========
    sqlContent += `-- ================================================================
-- EXPORT COMPLETE
-- ================================================================
-- Generated: ${new Date().toISOString()}
-- 
-- NEXT STEPS FOR ON-PREMISES DEPLOYMENT:
-- 1. Set up Supabase locally: https://supabase.com/docs/guides/self-hosting
-- 2. Run this SQL file against your local PostgreSQL
-- 3. Copy edge functions from supabase/functions/ directory
-- 4. Update .env file with your local Supabase URL and keys
-- 5. Build and deploy the frontend pointing to local backend
-- 
-- IMPORTANT: Test thoroughly before going live!
-- ================================================================
`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        sql: sqlContent,
        exportDate,
        exportedBy: user.email,
        message: "Complete database export with schema, functions, RLS policies, and data"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error exporting database:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
      }
    );
  }
};

serve(handler);
