import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklyMetrics {
  totalCalls: number;
  interestedCalls: number;
  notInterestedCalls: number;
  notAnsweredCalls: number;
  leadsGenerated: number;
  conversionRate: number;
}

interface AgentSummary {
  id: string;
  name: string;
  email: string;
  metrics: WeeklyMetrics;
}

interface TeamSummary {
  id: string;
  name: string;
  metrics: WeeklyMetrics;
  agents: AgentSummary[];
}

interface ReportData {
  reportPeriod: {
    start: string;
    end: string;
  };
  teamSummaries: TeamSummary[];
  alertsSummary: {
    active: number;
    acknowledged: number;
    resolved: number;
    critical: number;
  };
  generatedAt: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user has admin, operations_head, or supervisor role
    const { data: roleData, error: roleError } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "User has no assigned role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedRoles = ["admin", "super_admin", "operations_head", "supervisor"];
    if (!allowedRoles.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions to generate reports" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Weekly report generation initiated by user ${user.id} with role ${roleData.role}`);

    // Use service role client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { scheduleId, manual = false } = await req.json();

    // Calculate date range for last week
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - now.getDay()); // Last Sunday
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    console.log(`Generating report for period: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);

    // Fetch all teams
    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name");

    if (teamsError) throw teamsError;

    // Fetch all active agents with their team assignments
    const { data: agents, error: agentsError } = await supabase
      .from("profiles")
      .select("id, full_name, username, email, team_id")
      .eq("is_active", true);

    if (agentsError) throw agentsError;

    // Fetch call feedback for the week
    const { data: feedback, error: feedbackError } = await supabase
      .from("call_feedback")
      .select("agent_id, feedback_status")
      .gte("call_timestamp", weekStart.toISOString())
      .lte("call_timestamp", weekEnd.toISOString());

    if (feedbackError) throw feedbackError;

    // Fetch leads for the week
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("agent_id")
      .gte("created_at", weekStart.toISOString())
      .lte("created_at", weekEnd.toISOString());

    if (leadsError) throw leadsError;

    // Fetch alerts summary
    const { data: alerts, error: alertsError } = await supabase
      .from("performance_alerts")
      .select("alert_status, severity")
      .gte("created_at", weekStart.toISOString())
      .lte("created_at", weekEnd.toISOString());

    if (alertsError) throw alertsError;

    // Calculate metrics per agent
    const agentMetrics: Record<string, WeeklyMetrics> = {};
    
    for (const agent of agents || []) {
      const agentFeedback = feedback?.filter(f => f.agent_id === agent.id) || [];
      const agentLeads = leads?.filter(l => l.agent_id === agent.id) || [];
      
      const totalCalls = agentFeedback.length;
      const interestedCalls = agentFeedback.filter(f => f.feedback_status === "interested").length;
      const notInterestedCalls = agentFeedback.filter(f => f.feedback_status === "not_interested").length;
      const notAnsweredCalls = agentFeedback.filter(f => f.feedback_status === "not_answered").length;
      
      agentMetrics[agent.id] = {
        totalCalls,
        interestedCalls,
        notInterestedCalls,
        notAnsweredCalls,
        leadsGenerated: agentLeads.length,
        conversionRate: totalCalls > 0 ? Math.round((interestedCalls / totalCalls) * 100) : 0,
      };
    }

    // Build team summaries
    const teamSummaries: TeamSummary[] = (teams || []).map(team => {
      const teamAgents = (agents || []).filter(a => a.team_id === team.id);
      
      const agentSummaries: AgentSummary[] = teamAgents.map(agent => ({
        id: agent.id,
        name: agent.full_name || agent.username,
        email: agent.email,
        metrics: agentMetrics[agent.id] || {
          totalCalls: 0,
          interestedCalls: 0,
          notInterestedCalls: 0,
          notAnsweredCalls: 0,
          leadsGenerated: 0,
          conversionRate: 0,
        },
      }));

      // Aggregate team metrics
      const teamMetrics = agentSummaries.reduce(
        (acc, agent) => ({
          totalCalls: acc.totalCalls + agent.metrics.totalCalls,
          interestedCalls: acc.interestedCalls + agent.metrics.interestedCalls,
          notInterestedCalls: acc.notInterestedCalls + agent.metrics.notInterestedCalls,
          notAnsweredCalls: acc.notAnsweredCalls + agent.metrics.notAnsweredCalls,
          leadsGenerated: acc.leadsGenerated + agent.metrics.leadsGenerated,
          conversionRate: 0,
        }),
        {
          totalCalls: 0,
          interestedCalls: 0,
          notInterestedCalls: 0,
          notAnsweredCalls: 0,
          leadsGenerated: 0,
          conversionRate: 0,
        }
      );

      teamMetrics.conversionRate = teamMetrics.totalCalls > 0 
        ? Math.round((teamMetrics.interestedCalls / teamMetrics.totalCalls) * 100) 
        : 0;

      return {
        id: team.id,
        name: team.name,
        metrics: teamMetrics,
        agents: agentSummaries,
      };
    });

    // Calculate alerts summary
    const alertsSummary = {
      active: alerts?.filter(a => a.alert_status === "active").length || 0,
      acknowledged: alerts?.filter(a => a.alert_status === "acknowledged").length || 0,
      resolved: alerts?.filter(a => a.alert_status === "resolved").length || 0,
      critical: alerts?.filter(a => a.severity === "critical").length || 0,
    };

    const reportData: ReportData = {
      reportPeriod: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      },
      teamSummaries,
      alertsSummary,
      generatedAt: new Date().toISOString(),
    };

    // Update last_sent_at if this was a scheduled report
    if (scheduleId) {
      await supabase
        .from("scheduled_reports")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", scheduleId);
    }

    console.log(`Report generated successfully with ${teamSummaries.length} teams`);

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error generating report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
