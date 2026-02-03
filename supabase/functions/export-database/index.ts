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

    console.log(`Database export initiated by super_admin: ${user.id}`);

    const exportDate = new Date().toISOString();
    let sqlContent = `-- Database Export\n-- Generated: ${exportDate}\n-- Exported by: ${user.email}\n\n`;

    // List of tables to export (in order of dependencies)
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
    ];

    // Export each table's data
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

        sqlContent += `-- Table: ${tableName}\n`;
        sqlContent += `-- Rows: ${data.length}\n`;
        sqlContent += `DELETE FROM public.${tableName};\n`;

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

          sqlContent += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        sqlContent += `\n`;
      } catch (tableError) {
        console.error(`Error processing ${tableName}:`, tableError);
        sqlContent += `-- Error processing ${tableName}\n\n`;
      }
    }

    sqlContent += `-- Export completed: ${new Date().toISOString()}\n`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        sql: sqlContent,
        exportDate,
        exportedBy: user.email
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
