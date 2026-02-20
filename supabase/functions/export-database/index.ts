import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleData || []).map((r: any) => r.role);
    if (!roles.includes("super_admin")) {
      return new Response(JSON.stringify({ error: "Only super_admin can export" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Database export by super_admin: ${user.id}`);

    // Use streaming to avoid timeout
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const write = (text: string) => controller.enqueue(encoder.encode(text));

        const exportDate = new Date().toISOString();

        // Header
        write(`-- COMPLETE DATABASE EXPORT - ${exportDate}\n`);
        write(`-- Exported by: ${user.email}\n`);
        write(`-- WARNING: Contains sensitive data. Store securely!\n\n`);

        // Extensions
        write(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\nCREATE EXTENSION IF NOT EXISTS "pgjwt";\nCREATE EXTENSION IF NOT EXISTS "pg_net";\n\n`);

        // Enums
        write(`-- ENUM TYPES\n`);
        write(`DO $$ BEGIN\n  DROP TYPE IF EXISTS public.app_role CASCADE;\n  DROP TYPE IF EXISTS public.activity_type CASCADE;\n  DROP TYPE IF EXISTS public.attendance_status CASCADE;\n  DROP TYPE IF EXISTS public.contact_status CASCADE;\n  DROP TYPE IF EXISTS public.upload_status CASCADE;\n  DROP TYPE IF EXISTS public.call_status CASCADE;\n  DROP TYPE IF EXISTS public.feedback_status CASCADE;\n  DROP TYPE IF EXISTS public.action_type CASCADE;\n  DROP TYPE IF EXISTS public.lead_status CASCADE;\n  DROP TYPE IF EXISTS public.case_status CASCADE;\n  DROP TYPE IF EXISTS public.case_bank CASCADE;\n  DROP TYPE IF EXISTS public.document_type CASCADE;\n  DROP TYPE IF EXISTS public.follow_up_type CASCADE;\n  DROP TYPE IF EXISTS public.audit_action CASCADE;\n  DROP TYPE IF EXISTS public.alert_type CASCADE;\n  DROP TYPE IF EXISTS public.alert_status CASCADE;\n  DROP TYPE IF EXISTS public.alert_severity CASCADE;\n  DROP TYPE IF EXISTS public.idle_alert_severity CASCADE;\n  DROP TYPE IF EXISTS public.team_type CASCADE;\n  DROP TYPE IF EXISTS public.submission_group CASCADE;\nEXCEPTION WHEN OTHERS THEN NULL;\nEND $$;\n\n`);
        write(`CREATE TYPE public.app_role AS ENUM ('agent', 'supervisor', 'operations_head', 'coordinator', 'admin', 'super_admin', 'sales_controller');\n`);
        write(`CREATE TYPE public.activity_type AS ENUM ('calling', 'break', 'lunch', 'meeting', 'training', 'followup', 'others', 'idle');\n`);
        write(`CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'leave');\n`);
        write(`CREATE TYPE public.contact_status AS ENUM ('new', 'contacted', 'interested', 'not_interested', 'callback', 'converted', 'dnc');\n`);
        write(`CREATE TYPE public.upload_status AS ENUM ('pending', 'approved', 'rejected', 'partial');\n`);
        write(`CREATE TYPE public.call_status AS ENUM ('pending', 'completed', 'skipped');\n`);
        write(`CREATE TYPE public.feedback_status AS ENUM ('interested', 'not_interested', 'callback', 'not_answered', 'wrong_number', 'already_have', 'switched_off', 'busy');\n`);
        write(`CREATE TYPE public.action_type AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'note');\n`);
        write(`CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');\n`);
        write(`CREATE TYPE public.case_status AS ENUM ('new', 'documents_pending', 'documents_submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'closed', 'on_hold');\n`);
        write(`CREATE TYPE public.case_bank AS ENUM ('NBF', 'UBL', 'RAK', 'Mashreq', 'WIO', 'RUYA', 'Other');\n`);
        write(`CREATE TYPE public.document_type AS ENUM ('trade_license', 'emirates_id', 'passport', 'bank_statement', 'vat_certificate', 'moa', 'aoa', 'power_of_attorney', 'salary_certificate', 'other');\n`);
        write(`CREATE TYPE public.follow_up_type AS ENUM ('call', 'email', 'meeting', 'document_collection', 'bank_visit', 'other');\n`);
        write(`CREATE TYPE public.audit_action AS ENUM ('created', 'status_changed', 'document_uploaded', 'document_verified', 'note_added', 'assigned', 'priority_changed');\n`);
        write(`CREATE TYPE public.alert_type AS ENUM ('team', 'agent');\n`);
        write(`CREATE TYPE public.alert_status AS ENUM ('active', 'acknowledged', 'resolved');\n`);
        write(`CREATE TYPE public.alert_severity AS ENUM ('low', 'medium', 'high', 'critical');\n`);
        write(`CREATE TYPE public.idle_alert_severity AS ENUM ('warning', 'escalation');\n`);
        write(`CREATE TYPE public.team_type AS ENUM ('sales', 'coordination', 'support');\n`);
        write(`CREATE TYPE public.submission_group AS ENUM ('group1', 'group2');\n\n`);

        // Table definitions (same schema as before, streamed)
        write(`-- TABLE DEFINITIONS\n`);
        const tableDDL = `
CREATE TABLE IF NOT EXISTS public.teams (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, team_type public.team_type NOT NULL, leader_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.profiles (id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, username VARCHAR NOT NULL, email VARCHAR NOT NULL, full_name VARCHAR, phone_number VARCHAR, whatsapp_number VARCHAR, avatar_url TEXT, is_active BOOLEAN DEFAULT true, team_id UUID REFERENCES public.teams(id), supervisor_id UUID REFERENCES public.profiles(id), login_streak_current INTEGER DEFAULT 0, login_streak_longest INTEGER DEFAULT 0, last_login_date DATE, last_login TIMESTAMPTZ, max_case_capacity INTEGER DEFAULT 50, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE public.teams ADD CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS public.user_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL DEFAULT 'agent', created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id, role));
CREATE TABLE IF NOT EXISTS public.activity_config (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_key TEXT NOT NULL UNIQUE, config_value JSONB NOT NULL, description TEXT, updated_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.activity_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id), date DATE NOT NULL DEFAULT CURRENT_DATE, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, is_active BOOLEAN DEFAULT false, current_activity TEXT, current_activity_started_at TIMESTAMPTZ, total_others_minutes INTEGER DEFAULT 0, missed_confirmations INTEGER DEFAULT 0, last_confirmation_at TIMESTAMPTZ, end_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, date));
CREATE TABLE IF NOT EXISTS public.activity_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id), activity_type public.activity_type NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ, duration_minutes INTEGER, is_system_enforced BOOLEAN NOT NULL DEFAULT false, metadata JSONB DEFAULT '{}', activity_details TEXT, confirmed_at TIMESTAMPTZ, confirmation_status TEXT, auto_switch_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.activity_confirmations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES public.activity_sessions(id), user_id UUID NOT NULL REFERENCES auth.users(id), prompted_at TIMESTAMPTZ NOT NULL DEFAULT now(), responded_at TIMESTAMPTZ, response_type TEXT, activity_before TEXT, activity_after TEXT, auto_switch_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.attendance_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id), date DATE NOT NULL DEFAULT CURRENT_DATE, status public.attendance_status DEFAULT 'present', first_login TIMESTAMPTZ, last_logout TIMESTAMPTZ, start_button_pressed_at TIMESTAMPTZ, is_working BOOLEAN DEFAULT false, is_late BOOLEAN DEFAULT false, late_by_minutes INTEGER DEFAULT 0, total_work_minutes INTEGER DEFAULT 0, total_break_minutes INTEGER DEFAULT 0, daily_score NUMERIC, missed_confirmations INTEGER DEFAULT 0, last_confirmation_at TIMESTAMPTZ, end_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, date));
CREATE TABLE IF NOT EXISTS public.agent_goals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL REFERENCES auth.users(id), goal_type TEXT NOT NULL, metric TEXT NOT NULL, target_value INTEGER NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agent_submissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL REFERENCES auth.users(id), submission_date DATE NOT NULL DEFAULT CURRENT_DATE, submission_group public.submission_group NOT NULL, bank_name TEXT NOT NULL, company_name TEXT NOT NULL DEFAULT '', notes TEXT, status TEXT NOT NULL DEFAULT 'pending', review_notes TEXT, reviewed_at TIMESTAMPTZ, reviewed_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.agent_talk_time (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL REFERENCES auth.users(id), date DATE NOT NULL DEFAULT CURRENT_DATE, talk_time_minutes INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(agent_id, date));
CREATE TABLE IF NOT EXISTS public.master_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), phone_number VARCHAR NOT NULL UNIQUE, company_name VARCHAR NOT NULL, contact_person_name VARCHAR DEFAULT '', industry VARCHAR, area VARCHAR, city VARCHAR, trade_license_number VARCHAR, status public.contact_status DEFAULT 'new', first_uploaded_by UUID, first_upload_date TIMESTAMPTZ DEFAULT now(), current_owner_agent_id UUID, ownership_lock_until DATE, in_company_pool BOOLEAN DEFAULT false, pool_entry_date TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.call_sheet_uploads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL REFERENCES auth.users(id), upload_date DATE NOT NULL DEFAULT CURRENT_DATE, upload_timestamp TIMESTAMPTZ DEFAULT now(), file_name VARCHAR, file_size INTEGER, total_entries_submitted INTEGER DEFAULT 0, valid_entries INTEGER DEFAULT 0, invalid_entries INTEGER DEFAULT 0, duplicate_entries INTEGER DEFAULT 0, approved_count INTEGER DEFAULT 0, rejected_count INTEGER DEFAULT 0, status public.upload_status DEFAULT 'pending', approval_timestamp TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.approved_call_list (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), upload_id UUID REFERENCES public.call_sheet_uploads(id), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL REFERENCES auth.users(id), list_date DATE NOT NULL DEFAULT CURRENT_DATE, call_order INTEGER NOT NULL, call_status public.call_status DEFAULT 'pending', called_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.call_feedback (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL REFERENCES auth.users(id), call_list_id UUID REFERENCES public.approved_call_list(id), call_timestamp TIMESTAMPTZ DEFAULT now(), feedback_status public.feedback_status NOT NULL, callback_datetime TIMESTAMPTZ, notes TEXT, whatsapp_sent BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.contact_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL REFERENCES auth.users(id), action_type public.action_type NOT NULL, action_date TIMESTAMPTZ DEFAULT now(), feedback_status public.feedback_status, notes TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.leads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL REFERENCES auth.users(id), lead_status public.lead_status DEFAULT 'new', lead_source TEXT DEFAULT 'cold_call', lead_score INTEGER DEFAULT 0, qualified_date DATE DEFAULT CURRENT_DATE, expected_close_date DATE, deal_value NUMERIC, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.lead_stage_transitions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL REFERENCES public.leads(id), from_status public.lead_status, to_status public.lead_status NOT NULL, changed_by UUID, changed_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.cases (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_number TEXT NOT NULL UNIQUE, lead_id UUID REFERENCES public.leads(id), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), coordinator_id UUID NOT NULL REFERENCES auth.users(id), original_agent_id UUID NOT NULL REFERENCES auth.users(id), bank public.case_bank NOT NULL, product_type TEXT NOT NULL, status public.case_status NOT NULL DEFAULT 'new', priority INTEGER DEFAULT 2, deal_value NUMERIC, expected_completion_date DATE, actual_completion_date DATE, notes TEXT, internal_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.case_audit_trail (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id UUID NOT NULL REFERENCES public.cases(id), action public.audit_action NOT NULL, performed_by UUID NOT NULL REFERENCES auth.users(id), old_value JSONB, new_value JSONB, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.case_documents (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id UUID NOT NULL REFERENCES public.cases(id), document_type public.document_type NOT NULL, file_name TEXT NOT NULL, file_path TEXT NOT NULL, file_size INTEGER, uploaded_by UUID NOT NULL REFERENCES auth.users(id), is_verified BOOLEAN DEFAULT false, verified_by UUID, verified_at TIMESTAMPTZ, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.follow_ups (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id UUID NOT NULL REFERENCES public.cases(id), follow_up_type public.follow_up_type NOT NULL, scheduled_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ, created_by UUID NOT NULL REFERENCES auth.users(id), notes TEXT, outcome TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.banker_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bank public.case_bank NOT NULL, name TEXT NOT NULL, title TEXT, phone TEXT, email TEXT, notes TEXT, is_active BOOLEAN DEFAULT true, created_by UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.document_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bank public.case_bank NOT NULL, product_type TEXT NOT NULL, document_type public.document_type NOT NULL, description TEXT, is_required BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.do_not_call_list (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), phone_number VARCHAR NOT NULL UNIQUE, reason TEXT, added_by UUID, added_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.performance_targets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), target_type public.alert_type NOT NULL, team_id UUID REFERENCES public.teams(id), agent_id UUID REFERENCES public.profiles(id), metric TEXT NOT NULL, period TEXT NOT NULL DEFAULT 'daily', target_value NUMERIC NOT NULL, threshold_percentage NUMERIC NOT NULL DEFAULT 80, is_active BOOLEAN NOT NULL DEFAULT true, created_by UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.performance_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), target_id UUID NOT NULL REFERENCES public.performance_targets(id), alert_type public.alert_type NOT NULL, team_id UUID REFERENCES public.teams(id), agent_id UUID REFERENCES public.profiles(id), metric TEXT NOT NULL, target_value NUMERIC NOT NULL, actual_value NUMERIC NOT NULL, percentage_achieved NUMERIC NOT NULL, severity public.alert_severity NOT NULL DEFAULT 'medium', alert_status public.alert_status NOT NULL DEFAULT 'active', message TEXT, acknowledged_by UUID REFERENCES public.profiles(id), acknowledged_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.performance_cache (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL REFERENCES auth.users(id), cache_date DATE NOT NULL DEFAULT CURRENT_DATE, total_calls INTEGER DEFAULT 0, interested_count INTEGER DEFAULT 0, not_interested_count INTEGER DEFAULT 0, not_answered_count INTEGER DEFAULT 0, whatsapp_sent INTEGER DEFAULT 0, leads_generated INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE(agent_id, cache_date));
CREATE TABLE IF NOT EXISTS public.scheduled_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), report_type TEXT NOT NULL DEFAULT 'weekly_performance', frequency TEXT NOT NULL DEFAULT 'weekly', schedule_day INTEGER NOT NULL DEFAULT 1, schedule_time TIME NOT NULL DEFAULT '08:00:00', recipients JSONB NOT NULL DEFAULT '[]', include_team_summary BOOLEAN NOT NULL DEFAULT true, include_agent_breakdown BOOLEAN NOT NULL DEFAULT true, include_alerts_summary BOOLEAN NOT NULL DEFAULT true, is_active BOOLEAN NOT NULL DEFAULT true, last_sent_at TIMESTAMPTZ, created_by UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.supervisor_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supervisor_id UUID NOT NULL REFERENCES auth.users(id), agent_id UUID NOT NULL REFERENCES auth.users(id), agent_name TEXT, alert_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, details JSONB, is_read BOOLEAN DEFAULT false, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.idle_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id), alert_time TIMESTAMPTZ NOT NULL DEFAULT now(), idle_duration_minutes INTEGER NOT NULL, severity public.idle_alert_severity NOT NULL, was_acknowledged BOOLEAN DEFAULT false, acknowledged_at TIMESTAMPTZ, escalated_to UUID, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.coach_conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL REFERENCES auth.users(id), title TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.coach_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES public.coach_conversations(id), role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.upload_processing_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), upload_id UUID REFERENCES public.call_sheet_uploads(id), agent_id UUID NOT NULL REFERENCES auth.users(id), session_id TEXT NOT NULL, file_name TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ, log_entries JSONB NOT NULL DEFAULT '[]', summary JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.upload_rejections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), upload_id UUID NOT NULL REFERENCES public.call_sheet_uploads(id), row_number INTEGER, company_name VARCHAR, phone_number VARCHAR, rejection_reason TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS public.followup_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id), followup_count INTEGER NOT NULL DEFAULT 0, remark TEXT, remark_time TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.meeting_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id), client_name TEXT NOT NULL, outcome TEXT NOT NULL, next_step TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR NOT NULL, category VARCHAR NOT NULL DEFAULT 'follow_up', content TEXT NOT NULL, placeholders TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT true, created_by UUID NOT NULL REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;
        write(tableDDL);
        write(`\n`);

        // Functions (compact)
        write(`-- DATABASE FUNCTIONS\n`);
        write(`CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid) RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT team_id FROM public.profiles WHERE id = _user_id $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.get_led_team_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT id FROM public.teams WHERE leader_id = _user_id LIMIT 1 $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id uuid, _team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND leader_id = _user_id) $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.is_coordinator(user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = is_coordinator.user_id AND role = 'coordinator') $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN INSERT INTO public.profiles (id, username, email, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)), NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', '')); INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent'); RETURN NEW; END; $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.check_dnc(phone_to_check text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS(SELECT 1 FROM do_not_call_list WHERE phone_number = phone_to_check) $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.find_contact_by_phone(phone text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE contact_id uuid; BEGIN SELECT id INTO contact_id FROM master_contacts WHERE phone_number = phone LIMIT 1; RETURN contact_id; END; $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.generate_case_number() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ DECLARE year_prefix TEXT; next_num INTEGER; case_num TEXT; BEGIN year_prefix := TO_CHAR(CURRENT_DATE, 'YY'); SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 4) AS INTEGER)), 0) + 1 INTO next_num FROM public.cases WHERE case_number LIKE year_prefix || '-%'; case_num := year_prefix || '-' || LPAD(next_num::TEXT, 5, '0'); RETURN case_num; END; $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.track_lead_stage_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN INSERT INTO public.lead_stage_transitions (lead_id, from_status, to_status, changed_by) VALUES (NEW.id, OLD.lead_status, NEW.lead_status, auth.uid()); END IF; RETURN NEW; END; $$;\n`);
        write(`CREATE OR REPLACE FUNCTION public.track_lead_creation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN INSERT INTO public.lead_stage_transitions (lead_id, from_status, to_status, changed_by) VALUES (NEW.id, NULL, NEW.lead_status, auth.uid()); RETURN NEW; END; $$;\n`);
        write(`\n`);

        // Triggers
        write(`-- TRIGGERS\n`);
        write(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;\nCREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();\n`);
        write(`CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();\n`);
        write(`CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();\n`);
        write(`CREATE TRIGGER update_activity_sessions_updated_at BEFORE UPDATE ON public.activity_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();\n`);
        write(`CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();\n`);
        write(`CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();\n`);
        write(`CREATE TRIGGER track_lead_status_change AFTER UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.track_lead_stage_transition();\n`);
        write(`CREATE TRIGGER track_lead_created AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.track_lead_creation();\n\n`);

        // RLS
        write(`-- ROW LEVEL SECURITY\n`);
        const rlsTables = ['teams','profiles','user_roles','activity_config','activity_sessions','activity_logs','activity_confirmations','attendance_records','agent_goals','agent_submissions','agent_talk_time','master_contacts','call_sheet_uploads','approved_call_list','call_feedback','contact_history','leads','lead_stage_transitions','cases','case_audit_trail','case_documents','follow_ups','banker_contacts','document_templates','do_not_call_list','performance_targets','performance_alerts','performance_cache','scheduled_reports','supervisor_alerts','idle_alerts','coach_conversations','coach_messages','upload_processing_logs','upload_rejections','followup_logs','meeting_logs','whatsapp_templates'];
        for (const t of rlsTables) write(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;\n`);
        write(`\n`);

        // Key RLS policies
        write(`CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);\n`);
        write(`CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`CREATE POLICY "Users can view own full profile" ON public.profiles FOR SELECT USING (id = auth.uid());\n`);
        write(`CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);\n`);
        write(`CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);\n`);
        write(`CREATE POLICY "Management can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'operations_head') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`CREATE POLICY "Users can view their own team" ON public.teams FOR SELECT USING (id = get_user_team_id(auth.uid()) OR leader_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`CREATE POLICY "Admins can create teams" ON public.teams FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`);
        write(`\n`);

        // AUTH USERS DATA with pagination
        write(`-- AUTH.USERS DATA\n`);
        try {
          let page = 1;
          let totalUsers = 0;
          let hasMore = true;
          while (hasMore) {
            const { data: authData, error: aErr } = await supabase.auth.admin.listUsers({ page, perPage: 500 });
            if (aErr || !authData?.users?.length) { hasMore = false; break; }
            for (const au of authData.users) {
              totalUsers++;
              const ud: Record<string, unknown> = {
                instance_id: '00000000-0000-0000-0000-000000000000', id: au.id, aud: au.aud || 'authenticated', role: au.role || 'authenticated',
                email: au.email, encrypted_password: (au as any).encrypted_password || '', email_confirmed_at: au.email_confirmed_at,
                invited_at: (au as any).invited_at, confirmation_token: '', confirmation_sent_at: (au as any).confirmation_sent_at,
                recovery_token: '', recovery_sent_at: (au as any).recovery_sent_at, email_change_token_new: '', email_change: '',
                email_change_sent_at: null, last_sign_in_at: au.last_sign_in_at, raw_app_meta_data: au.app_metadata || {},
                raw_user_meta_data: au.user_metadata || {}, is_super_admin: false, created_at: au.created_at, updated_at: au.updated_at,
                phone: au.phone, phone_confirmed_at: au.phone_confirmed_at, phone_change: '', phone_change_token: '',
                phone_change_sent_at: null, confirmed_at: au.confirmed_at, email_change_token_current: '', email_change_confirm_status: 0,
                banned_until: (au as any).banned_until, reauthentication_token: '', reauthentication_sent_at: null, is_sso_user: false, deleted_at: null,
              };
              const cols = Object.keys(ud);
              const vals = cols.map(c => escapeSQL(ud[c]));
              write(`INSERT INTO auth.users (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`);
            }
            hasMore = authData.users.length === 500;
            page++;
          }
          write(`-- Total auth users exported: ${totalUsers}\n\n`);
        } catch (e) {
          write(`-- Error exporting auth users\n\n`);
        }

        // PUBLIC SCHEMA DATA with pagination
        write(`-- PUBLIC SCHEMA DATA\n`);
        const tables = [
          'teams','profiles','user_roles','activity_config','activity_sessions','activity_logs','activity_confirmations',
          'attendance_records','agent_goals','agent_submissions','agent_talk_time','master_contacts','call_sheet_uploads',
          'approved_call_list','call_feedback','contact_history','leads','lead_stage_transitions','cases','case_audit_trail',
          'case_documents','follow_ups','banker_contacts','document_templates','do_not_call_list','performance_targets',
          'performance_alerts','performance_cache','scheduled_reports','supervisor_alerts','idle_alerts','coach_conversations',
          'coach_messages','upload_processing_logs','upload_rejections','followup_logs','meeting_logs','whatsapp_templates',
        ];

        for (const tableName of tables) {
          try {
            let offset = 0;
            let totalRows = 0;
            let hasMore = true;
            write(`-- Table: ${tableName}\n`);
            while (hasMore) {
              const { data, error } = await supabase.from(tableName).select('*').range(offset, offset + 999);
              if (error) { write(`-- Error: ${error.message}\n`); break; }
              if (!data || data.length === 0) { hasMore = false; break; }
              for (const row of data) {
                const columns = Object.keys(row);
                const values = columns.map(col => escapeSQL(row[col]));
                write(`INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`);
                totalRows++;
              }
              offset += 1000;
              hasMore = data.length === 1000;
            }
            write(`-- ${tableName}: ${totalRows} rows\n\n`);
          } catch (e) {
            write(`-- Error processing ${tableName}\n\n`);
          }
        }

        // Storage + Views
        write(`-- STORAGE\nINSERT INTO storage.buckets (id, name, public) VALUES ('case-documents', 'case-documents', false) ON CONFLICT (id) DO NOTHING;\n\n`);
        write(`-- VIEWS\nCREATE OR REPLACE VIEW public.profiles_public AS SELECT id, username, full_name, avatar_url, is_active, team_id, supervisor_id, login_streak_current, login_streak_longest, last_login_date, created_at, updated_at FROM public.profiles;\n`);
        write(`CREATE OR REPLACE VIEW public.profiles_secure AS SELECT id, username, full_name, email, phone_number, whatsapp_number, avatar_url, is_active, team_id, supervisor_id, login_streak_current, login_streak_longest, last_login_date, last_login, created_at, updated_at FROM public.profiles;\n\n`);
        write(`-- EXPORT COMPLETE - ${new Date().toISOString()}\n`);

        controller.close();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="database_export_${new Date().toISOString().split('T')[0]}.sql"`,
      },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
};

serve(handler);
