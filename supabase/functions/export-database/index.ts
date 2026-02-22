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

const ALL_TABLES = [
  'teams','profiles','user_roles','activity_config','activity_sessions','activity_logs','activity_confirmations',
  'attendance_records','agent_goals','agent_submissions','agent_talk_time','master_contacts','call_sheet_uploads',
  'approved_call_list','call_feedback','contact_history','leads','lead_stage_transitions','cases','case_audit_trail',
  'case_documents','follow_ups','banker_contacts','document_templates','do_not_call_list','performance_targets',
  'performance_alerts','performance_cache','scheduled_reports','supervisor_alerts','idle_alerts','coach_conversations',
  'coach_messages','upload_processing_logs','upload_rejections','followup_logs','meeting_logs','whatsapp_templates','whatsapp_messages',
];

async function verifyAdmin(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (roleData || []).map((r: any) => r.role);
  if (!roles.includes("super_admin")) return null;
  return user;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const user = await verifyAdmin(req, supabase);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized. Super admin only." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "schema";
    const tableName = url.searchParams.get("table");

    // ─── ACTION: list tables ───────────────────────────────────────────────
    if (action === "tables") {
      return new Response(JSON.stringify({ tables: ALL_TABLES }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACTION: export auth users ────────────────────────────────────────
    if (action === "auth") {
      console.log(`Auth export by super_admin: ${user.id}`);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (t: string) => controller.enqueue(encoder.encode(t));
          write(`-- AUTH.USERS DATA\n`);
          try {
            let page = 1;
            let totalUsers = 0;
            let hasMore = true;
            while (hasMore) {
              const { data: authData, error: aErr } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
              if (aErr || !authData?.users?.length) { hasMore = false; break; }
              for (const au of authData.users) {
                totalUsers++;
                const ud: Record<string, unknown> = {
                  instance_id: '00000000-0000-0000-0000-000000000000',
                  id: au.id, aud: au.aud || 'authenticated', role: au.role || 'authenticated',
                  email: au.email, encrypted_password: (au as any).encrypted_password || '',
                  email_confirmed_at: au.email_confirmed_at || null,
                  invited_at: (au as any).invited_at || null,
                  confirmation_token: '', confirmation_sent_at: null,
                  recovery_token: '', recovery_sent_at: null,
                  email_change_token_new: '', email_change: '', email_change_sent_at: null,
                  last_sign_in_at: au.last_sign_in_at || null,
                  raw_app_meta_data: au.app_metadata || {},
                  raw_user_meta_data: au.user_metadata || {},
                  is_super_admin: false, created_at: au.created_at, updated_at: au.updated_at,
                  phone: au.phone || null, phone_confirmed_at: au.phone_confirmed_at || null,
                  phone_change: '', phone_change_token: '', phone_change_sent_at: null,
                  confirmed_at: au.confirmed_at || null, email_change_token_current: '',
                  email_change_confirm_status: 0, banned_until: null,
                  reauthentication_token: '', reauthentication_sent_at: null,
                  is_sso_user: false, deleted_at: null,
                };
                const cols = Object.keys(ud);
                const vals = cols.map(c => escapeSQL(ud[c]));
                write(`INSERT INTO auth.users (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`);
              }
              hasMore = authData.users.length === 100;
              page++;
            }
            write(`-- Total auth users: ${totalUsers}\n\n`);
          } catch (e) {
            write(`-- Error exporting auth users: ${e}\n\n`);
          }
          controller.close();
        }
      });
      return new Response(stream, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // ─── ACTION: export one table's data ──────────────────────────────────
    if (action === "table") {
      if (!tableName || !ALL_TABLES.includes(tableName)) {
        return new Response(JSON.stringify({ error: "Invalid table name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log(`Table export [${tableName}] by super_admin: ${user.id}`);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const write = (t: string) => controller.enqueue(encoder.encode(t));
          write(`-- Table: ${tableName}\n`);
          try {
            let offset = 0;
            let totalRows = 0;
            let hasMore = true;
            while (hasMore) {
              const { data, error } = await supabase
                .from(tableName as any)
                .select('*')
                .range(offset, offset + 499);
              if (error) { write(`-- Error: ${error.message}\n`); break; }
              if (!data || data.length === 0) { hasMore = false; break; }
              for (const row of data) {
                const columns = Object.keys(row);
                const values = columns.map(col => escapeSQL(row[col]));
                write(`INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`);
                totalRows++;
              }
              offset += 500;
              hasMore = data.length === 500;
            }
            write(`-- ${tableName}: ${totalRows} rows\n\n`);
          } catch (e) {
            write(`-- Error processing ${tableName}: ${e}\n\n`);
          }
          controller.close();
        }
      });
      return new Response(stream, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // ─── ACTION: schema (default) ─────────────────────────────────────────
    console.log(`Schema export by super_admin: ${user.id}`);
    const exportDate = new Date().toISOString();
    let sql = `-- COMPLETE DATABASE EXPORT - ${exportDate}\n`;
    sql += `-- Exported by: ${user.email}\n`;
    sql += `-- WARNING: Contains sensitive data. Store securely!\n\n`;

    sql += `-- EXTENSIONS\n`;
    sql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n`;

    sql += `-- ENUM TYPES\n`;
    sql += `DO $$ BEGIN\n`;
    const enumsToDrop = ['app_role','activity_type','attendance_status','contact_status','upload_status','call_status',
      'feedback_status','action_type','lead_status','case_status','case_bank','document_type','follow_up_type',
      'audit_action','alert_type','alert_status','alert_severity','idle_alert_severity','team_type','submission_group'];
    for (const e of enumsToDrop) sql += `  DROP TYPE IF EXISTS public.${e} CASCADE;\n`;
    sql += `EXCEPTION WHEN OTHERS THEN NULL;\nEND $$;\n\n`;

    sql += `CREATE TYPE public.app_role AS ENUM ('agent','supervisor','operations_head','coordinator','admin','super_admin','sales_controller');\n`;
    sql += `CREATE TYPE public.activity_type AS ENUM ('data_collection','customer_followup','calling_telecalling','calling_coldcalling','calling_calllist_movement','client_meeting','admin_documentation','training','system_bank_portal','break','idle');\n`;
    sql += `CREATE TYPE public.attendance_status AS ENUM ('present','late','absent','half_day');\n`;
    sql += `CREATE TYPE public.contact_status AS ENUM ('new','contacted','interested','not_interested','converted');\n`;
    sql += `CREATE TYPE public.upload_status AS ENUM ('pending','approved','rejected','supplemented');\n`;
    sql += `CREATE TYPE public.call_status AS ENUM ('pending','called','skipped');\n`;
    sql += `CREATE TYPE public.feedback_status AS ENUM ('not_answered','interested','not_interested','callback','wrong_number');\n`;
    sql += `CREATE TYPE public.action_type AS ENUM ('upload','call','feedback','reassign','status_change');\n`;
    sql += `CREATE TYPE public.lead_status AS ENUM ('new','contacted','qualified','converted','lost','approved','declined');\n`;
    sql += `CREATE TYPE public.case_status AS ENUM ('new','document_collection','under_review','submitted_to_bank','bank_processing','approved','declined','on_hold','cancelled');\n`;
    sql += `CREATE TYPE public.case_bank AS ENUM ('RAK','NBF','UBL','RUYA','MASHREQ','WIO');\n`;
    sql += `CREATE TYPE public.document_type AS ENUM ('trade_license','emirates_id','passport','visa','bank_statement','financials','moa','power_of_attorney','other');\n`;
    sql += `CREATE TYPE public.follow_up_type AS ENUM ('call','email','whatsapp','meeting','bank_visit','other');\n`;
    sql += `CREATE TYPE public.audit_action AS ENUM ('case_created','status_changed','document_uploaded','document_verified','note_added','follow_up_scheduled','follow_up_completed','assigned','reassigned');\n`;
    sql += `CREATE TYPE public.alert_type AS ENUM ('team','agent');\n`;
    sql += `CREATE TYPE public.alert_status AS ENUM ('active','acknowledged','resolved');\n`;
    sql += `CREATE TYPE public.alert_severity AS ENUM ('warning','critical');\n`;
    sql += `CREATE TYPE public.idle_alert_severity AS ENUM ('warning','escalation','discipline_flag');\n`;
    sql += `CREATE TYPE public.team_type AS ENUM ('remote','office');\n`;
    sql += `CREATE TYPE public.submission_group AS ENUM ('group1','group2');\n\n`;

    sql += `-- TABLE DEFINITIONS\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.teams (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, team_type public.team_type NOT NULL, leader_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.profiles (id UUID PRIMARY KEY, username VARCHAR NOT NULL, email VARCHAR NOT NULL, full_name VARCHAR, phone_number VARCHAR, whatsapp_number VARCHAR, avatar_url TEXT, is_active BOOLEAN DEFAULT true, team_id UUID REFERENCES public.teams(id), supervisor_id UUID REFERENCES public.profiles(id), login_streak_current INTEGER DEFAULT 0, login_streak_longest INTEGER DEFAULT 0, last_login_date DATE, last_login TIMESTAMPTZ, max_case_capacity INTEGER DEFAULT 50, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `ALTER TABLE public.teams ADD CONSTRAINT IF NOT EXISTS teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.user_roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, role public.app_role NOT NULL DEFAULT 'agent', UNIQUE(user_id, role));\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.activity_config (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_key TEXT NOT NULL UNIQUE, config_value JSONB NOT NULL, description TEXT, updated_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.activity_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, date DATE NOT NULL DEFAULT CURRENT_DATE, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, is_active BOOLEAN DEFAULT false, current_activity TEXT, current_activity_started_at TIMESTAMPTZ, total_others_minutes INTEGER DEFAULT 0, missed_confirmations INTEGER DEFAULT 0, last_confirmation_at TIMESTAMPTZ, end_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, date));\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.activity_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, activity_type public.activity_type NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ, duration_minutes INTEGER, is_system_enforced BOOLEAN NOT NULL DEFAULT false, metadata JSONB DEFAULT '{}', activity_details TEXT, confirmed_at TIMESTAMPTZ, confirmation_status TEXT, auto_switch_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.activity_confirmations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES public.activity_sessions(id), user_id UUID NOT NULL, prompted_at TIMESTAMPTZ NOT NULL DEFAULT now(), responded_at TIMESTAMPTZ, response_type TEXT, activity_before TEXT, activity_after TEXT, auto_switch_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.attendance_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, date DATE NOT NULL DEFAULT CURRENT_DATE, status public.attendance_status DEFAULT 'present', first_login TIMESTAMPTZ, last_logout TIMESTAMPTZ, start_button_pressed_at TIMESTAMPTZ, is_working BOOLEAN DEFAULT false, is_late BOOLEAN DEFAULT false, late_by_minutes INTEGER DEFAULT 0, total_work_minutes INTEGER DEFAULT 0, total_break_minutes INTEGER DEFAULT 0, daily_score NUMERIC, missed_confirmations INTEGER DEFAULT 0, last_confirmation_at TIMESTAMPTZ, end_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, date));\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.agent_goals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL, goal_type TEXT NOT NULL, metric TEXT NOT NULL, target_value INTEGER NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.agent_submissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL, submission_date DATE NOT NULL DEFAULT CURRENT_DATE, submission_group public.submission_group NOT NULL, bank_name TEXT NOT NULL, company_name TEXT NOT NULL DEFAULT '', notes TEXT, status TEXT NOT NULL DEFAULT 'pending', review_notes TEXT, reviewed_at TIMESTAMPTZ, reviewed_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.agent_talk_time (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL, date DATE NOT NULL DEFAULT CURRENT_DATE, talk_time_minutes INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(agent_id, date));\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.master_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), phone_number VARCHAR NOT NULL UNIQUE, company_name VARCHAR NOT NULL, contact_person_name VARCHAR DEFAULT '', industry VARCHAR, area VARCHAR, city VARCHAR, trade_license_number VARCHAR, status public.contact_status DEFAULT 'new', first_uploaded_by UUID, first_upload_date TIMESTAMPTZ DEFAULT now(), current_owner_agent_id UUID, ownership_lock_until DATE, in_company_pool BOOLEAN DEFAULT false, pool_entry_date TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.call_sheet_uploads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL, upload_date DATE NOT NULL DEFAULT CURRENT_DATE, upload_timestamp TIMESTAMPTZ DEFAULT now(), file_name VARCHAR, file_size INTEGER, total_entries_submitted INTEGER DEFAULT 0, valid_entries INTEGER DEFAULT 0, invalid_entries INTEGER DEFAULT 0, duplicate_entries INTEGER DEFAULT 0, approved_count INTEGER DEFAULT 0, rejected_count INTEGER DEFAULT 0, status public.upload_status DEFAULT 'pending', approval_timestamp TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.approved_call_list (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), upload_id UUID REFERENCES public.call_sheet_uploads(id), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL, list_date DATE NOT NULL DEFAULT CURRENT_DATE, call_order INTEGER NOT NULL, call_status public.call_status DEFAULT 'pending', called_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.call_feedback (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL, call_list_id UUID REFERENCES public.approved_call_list(id), call_timestamp TIMESTAMPTZ DEFAULT now(), feedback_status public.feedback_status NOT NULL, callback_datetime TIMESTAMPTZ, notes TEXT, whatsapp_sent BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.contact_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL, action_type public.action_type NOT NULL, action_date TIMESTAMPTZ DEFAULT now(), feedback_status public.feedback_status, notes TEXT, created_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.leads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), agent_id UUID NOT NULL, lead_status public.lead_status DEFAULT 'new', lead_source TEXT, lead_score INTEGER DEFAULT 0, qualified_date DATE DEFAULT CURRENT_DATE, expected_close_date DATE, deal_value NUMERIC, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.lead_stage_transitions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lead_id UUID NOT NULL REFERENCES public.leads(id), from_status public.lead_status, to_status public.lead_status NOT NULL, changed_by UUID, changed_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.cases (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_number TEXT NOT NULL UNIQUE, lead_id UUID REFERENCES public.leads(id), contact_id UUID NOT NULL REFERENCES public.master_contacts(id), coordinator_id UUID NOT NULL, original_agent_id UUID NOT NULL, bank public.case_bank NOT NULL, product_type TEXT NOT NULL, status public.case_status NOT NULL DEFAULT 'new', priority INTEGER DEFAULT 2, deal_value NUMERIC, expected_completion_date DATE, actual_completion_date DATE, notes TEXT, internal_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.case_audit_trail (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id UUID NOT NULL REFERENCES public.cases(id), action public.audit_action NOT NULL, performed_by UUID NOT NULL, old_value JSONB, new_value JSONB, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.case_documents (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id UUID NOT NULL REFERENCES public.cases(id), document_type public.document_type NOT NULL, file_name TEXT NOT NULL, file_path TEXT NOT NULL, file_size INTEGER, uploaded_by UUID NOT NULL, is_verified BOOLEAN DEFAULT false, verified_by UUID, verified_at TIMESTAMPTZ, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.follow_ups (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_id UUID NOT NULL REFERENCES public.cases(id), follow_up_type public.follow_up_type NOT NULL, scheduled_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ, created_by UUID NOT NULL, notes TEXT, outcome TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.banker_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bank public.case_bank NOT NULL, name TEXT NOT NULL, title TEXT, phone TEXT, email TEXT, notes TEXT, is_active BOOLEAN DEFAULT true, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.document_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bank public.case_bank NOT NULL, product_type TEXT NOT NULL, document_type public.document_type NOT NULL, description TEXT, is_required BOOLEAN DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.do_not_call_list (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), phone_number VARCHAR NOT NULL UNIQUE, reason TEXT, added_by UUID, added_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.performance_targets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), target_type public.alert_type NOT NULL, team_id UUID REFERENCES public.teams(id), agent_id UUID REFERENCES public.profiles(id), metric TEXT NOT NULL, period TEXT NOT NULL DEFAULT 'daily', target_value NUMERIC NOT NULL, threshold_percentage NUMERIC NOT NULL DEFAULT 80, is_active BOOLEAN NOT NULL DEFAULT true, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.performance_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), target_id UUID NOT NULL REFERENCES public.performance_targets(id), alert_type public.alert_type NOT NULL, team_id UUID REFERENCES public.teams(id), agent_id UUID REFERENCES public.profiles(id), metric TEXT NOT NULL, target_value NUMERIC NOT NULL, actual_value NUMERIC NOT NULL, percentage_achieved NUMERIC NOT NULL, severity public.alert_severity NOT NULL DEFAULT 'warning', alert_status public.alert_status NOT NULL DEFAULT 'active', message TEXT, acknowledged_by UUID REFERENCES public.profiles(id), acknowledged_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.performance_cache (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL, cache_date DATE NOT NULL DEFAULT CURRENT_DATE, total_calls INTEGER DEFAULT 0, interested_count INTEGER DEFAULT 0, not_interested_count INTEGER DEFAULT 0, not_answered_count INTEGER DEFAULT 0, whatsapp_sent INTEGER DEFAULT 0, leads_generated INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE(agent_id, cache_date));\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.scheduled_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), report_type TEXT NOT NULL DEFAULT 'weekly_performance', frequency TEXT NOT NULL DEFAULT 'weekly', schedule_day INTEGER NOT NULL DEFAULT 1, schedule_time TIME NOT NULL DEFAULT '08:00:00', recipients JSONB NOT NULL DEFAULT '[]', include_team_summary BOOLEAN NOT NULL DEFAULT true, include_agent_breakdown BOOLEAN NOT NULL DEFAULT true, include_alerts_summary BOOLEAN NOT NULL DEFAULT true, is_active BOOLEAN NOT NULL DEFAULT true, last_sent_at TIMESTAMPTZ, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.supervisor_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supervisor_id UUID NOT NULL, agent_id UUID NOT NULL, agent_name TEXT, alert_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, details JSONB, is_read BOOLEAN DEFAULT false, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.idle_alerts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, alert_time TIMESTAMPTZ NOT NULL DEFAULT now(), idle_duration_minutes INTEGER NOT NULL, severity public.idle_alert_severity NOT NULL, was_acknowledged BOOLEAN DEFAULT false, acknowledged_at TIMESTAMPTZ, escalated_to UUID, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.coach_conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL, title TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.coach_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES public.coach_conversations(id), role TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.upload_processing_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), upload_id UUID REFERENCES public.call_sheet_uploads(id), agent_id UUID NOT NULL, session_id TEXT NOT NULL, file_name TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), ended_at TIMESTAMPTZ, log_entries JSONB NOT NULL DEFAULT '[]', summary JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.upload_rejections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), upload_id UUID NOT NULL REFERENCES public.call_sheet_uploads(id), row_number INTEGER, company_name VARCHAR, phone_number VARCHAR, rejection_reason TEXT, created_at TIMESTAMPTZ DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.followup_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id), followup_count INTEGER NOT NULL DEFAULT 0, remark TEXT, remark_time TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.meeting_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), activity_log_id UUID NOT NULL REFERENCES public.activity_logs(id), client_name TEXT NOT NULL, outcome TEXT NOT NULL, next_step TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.whatsapp_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR NOT NULL, category VARCHAR NOT NULL DEFAULT 'follow_up', content TEXT NOT NULL, placeholders TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT true, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());\n\n`;

    sql += `-- VIEWS\n`;
    sql += `CREATE OR REPLACE VIEW public.profiles_public AS SELECT id, username, full_name, avatar_url, is_active, team_id, supervisor_id, login_streak_current, login_streak_longest, last_login_date, created_at, updated_at FROM public.profiles;\n`;
    sql += `CREATE OR REPLACE VIEW public.profiles_secure AS SELECT id, username, full_name, email, phone_number, whatsapp_number, avatar_url, is_active, team_id, supervisor_id, login_streak_current, login_streak_longest, last_login_date, last_login, created_at, updated_at FROM public.profiles;\n\n`;

    sql += `-- KEY FUNCTIONS\n`;
    sql += `CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;\n`;
    sql += `CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid) RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;\n`;
    sql += `CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT team_id FROM public.profiles WHERE id = _user_id $$;\n`;
    sql += `CREATE OR REPLACE FUNCTION public.get_led_team_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT id FROM public.teams WHERE leader_id = _user_id LIMIT 1 $$;\n`;
    sql += `CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id uuid, _team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND leader_id = _user_id) $$;\n`;
    sql += `CREATE OR REPLACE FUNCTION public.is_coordinator(user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = is_coordinator.user_id AND role = 'coordinator') $$;\n`;
    sql += `CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN INSERT INTO public.profiles (id, username, email, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)), NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', '')); INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent'); RETURN NEW; END; $$;\n`;
    sql += `CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;\n\n`;

    sql += `-- RLS\n`;
    const rlsTables = ALL_TABLES;
    for (const t of rlsTables) sql += `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;\n`;
    sql += `\n`;
    sql += `CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);\n`;
    sql += `CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`;
    sql += `CREATE POLICY "Users can view own full profile" ON public.profiles FOR SELECT USING (id = auth.uid());\n`;
    sql += `CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);\n`;
    sql += `CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);\n`;
    sql += `CREATE POLICY "Management can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'operations_head') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`;
    sql += `CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`;
    sql += `CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`;
    sql += `CREATE POLICY "Users can view their own team" ON public.teams FOR SELECT USING (id = get_user_team_id(auth.uid()) OR leader_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`;
    sql += `CREATE POLICY "Admins can create teams" ON public.teams FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`;
    sql += `CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n`;
    sql += `CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));\n\n`;

    sql += `-- STORAGE\n`;
    sql += `INSERT INTO storage.buckets (id, name, public) VALUES ('case-documents', 'case-documents', false) ON CONFLICT (id) DO NOTHING;\n\n`;
    sql += `-- Schema export complete: ${new Date().toISOString()}\n`;
    sql += `-- To get full data, run the export tool which fetches each table separately.\n`;

    return new Response(sql, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });

  } catch (error: any) {
    console.error("Export error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
};

serve(handler);
