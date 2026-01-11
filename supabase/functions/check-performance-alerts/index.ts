import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerformanceTarget {
  id: string;
  target_type: "team" | "agent";
  team_id: string | null;
  agent_id: string | null;
  metric: string;
  target_value: number;
  threshold_percentage: number;
  period: string;
  is_active: boolean;
}

interface PerformanceData {
  calls: number;
  leads: number;
  interested: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date ranges based on period
    const now = new Date();
    const getDateRange = (period: string) => {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      switch (period) {
        case "daily":
          return {
            start: today.toISOString(),
            end: now.toISOString(),
          };
        case "weekly":
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          return {
            start: weekStart.toISOString(),
            end: now.toISOString(),
          };
        case "monthly":
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return {
            start: monthStart.toISOString(),
            end: now.toISOString(),
          };
        default:
          return {
            start: today.toISOString(),
            end: now.toISOString(),
          };
      }
    };

    // Fetch all active performance targets
    const { data: targets, error: targetsError } = await supabase
      .from("performance_targets")
      .select("*")
      .eq("is_active", true);

    if (targetsError) {
      throw new Error(`Failed to fetch targets: ${targetsError.message}`);
    }

    if (!targets || targets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active targets found", alerts_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all profiles with team assignments
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, team_id")
      .eq("is_active", true);

    // Build team to agents map
    const teamAgentsMap = new Map<string, string[]>();
    profiles?.forEach((p) => {
      if (p.team_id) {
        const existing = teamAgentsMap.get(p.team_id) || [];
        teamAgentsMap.set(p.team_id, [...existing, p.id]);
      }
    });

    const alertsToCreate: any[] = [];
    const processedTargets = new Set<string>();

    for (const target of targets as PerformanceTarget[]) {
      // Skip if already processed (avoid duplicate alerts)
      const targetKey = `${target.id}-${target.period}`;
      if (processedTargets.has(targetKey)) continue;
      processedTargets.add(targetKey);

      const { start, end } = getDateRange(target.period);

      let performance: PerformanceData = { calls: 0, leads: 0, interested: 0 };
      let agentIds: string[] = [];

      if (target.target_type === "team" && target.team_id) {
        agentIds = teamAgentsMap.get(target.team_id) || [];
      } else if (target.target_type === "agent" && target.agent_id) {
        agentIds = [target.agent_id];
      }

      if (agentIds.length === 0) continue;

      // Get call feedback data
      const { data: feedbackData } = await supabase
        .from("call_feedback")
        .select("agent_id, feedback_status")
        .in("agent_id", agentIds)
        .gte("call_timestamp", start)
        .lte("call_timestamp", end);

      if (feedbackData) {
        performance.calls = feedbackData.length;
        performance.interested = feedbackData.filter(
          (f) => f.feedback_status === "interested"
        ).length;
      }

      // Get leads data
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id")
        .in("agent_id", agentIds)
        .gte("created_at", start)
        .lte("created_at", end);

      if (leadsData) {
        performance.leads = leadsData.length;
      }

      // Calculate actual value based on metric
      let actualValue = 0;
      switch (target.metric) {
        case "calls":
          actualValue = performance.calls;
          break;
        case "leads":
          actualValue = performance.leads;
          break;
        case "conversion_rate":
          actualValue =
            performance.calls > 0
              ? Math.round((performance.interested / performance.calls) * 100)
              : 0;
          break;
      }

      // Calculate percentage achieved
      const percentageAchieved =
        target.target_value > 0
          ? (actualValue / target.target_value) * 100
          : 0;

      // Check if below threshold
      if (percentageAchieved < target.threshold_percentage) {
        // Check if there's already an active/acknowledged alert for this target
        const { data: existingAlerts } = await supabase
          .from("performance_alerts")
          .select("id")
          .eq("target_id", target.id)
          .in("alert_status", ["active", "acknowledged"])
          .gte("created_at", start);

        if (!existingAlerts || existingAlerts.length === 0) {
          // Create new alert
          const metricLabels: Record<string, string> = {
            calls: "Calls",
            leads: "Leads",
            conversion_rate: "Conversion Rate",
          };

          alertsToCreate.push({
            target_id: target.id,
            alert_type: target.target_type,
            team_id: target.team_id,
            agent_id: target.agent_id,
            metric: target.metric,
            target_value: target.target_value,
            actual_value: actualValue,
            percentage_achieved: Math.round(percentageAchieved * 10) / 10,
            alert_status: "active",
            message: `${metricLabels[target.metric] || target.metric} is at ${actualValue} (${Math.round(percentageAchieved)}% of ${target.target_value} target) - below ${target.threshold_percentage}% threshold`,
          });
        }
      }
    }

    // Insert all alerts
    let alertsCreated = 0;
    if (alertsToCreate.length > 0) {
      const { data: insertedAlerts, error: insertError } = await supabase
        .from("performance_alerts")
        .insert(alertsToCreate)
        .select();

      if (insertError) {
        console.error("Failed to insert alerts:", insertError);
      } else {
        alertsCreated = insertedAlerts?.length || 0;
      }
    }

    // Auto-resolve alerts that are now above threshold
    const { data: activeAlerts } = await supabase
      .from("performance_alerts")
      .select("*, performance_targets!inner(*)")
      .eq("alert_status", "active");

    const alertsToResolve: string[] = [];

    if (activeAlerts) {
      for (const alert of activeAlerts) {
        const target = alert.performance_targets as PerformanceTarget;
        if (!target || !target.is_active) continue;

        const { start, end } = getDateRange(target.period);
        let agentIds: string[] = [];

        if (target.target_type === "team" && target.team_id) {
          agentIds = teamAgentsMap.get(target.team_id) || [];
        } else if (target.target_type === "agent" && target.agent_id) {
          agentIds = [target.agent_id];
        }

        if (agentIds.length === 0) continue;

        // Recalculate performance
        let actualValue = 0;

        if (target.metric === "calls" || target.metric === "conversion_rate") {
          const { data: feedbackData } = await supabase
            .from("call_feedback")
            .select("agent_id, feedback_status")
            .in("agent_id", agentIds)
            .gte("call_timestamp", start)
            .lte("call_timestamp", end);

          if (feedbackData) {
            if (target.metric === "calls") {
              actualValue = feedbackData.length;
            } else {
              const interested = feedbackData.filter(
                (f) => f.feedback_status === "interested"
              ).length;
              actualValue =
                feedbackData.length > 0
                  ? Math.round((interested / feedbackData.length) * 100)
                  : 0;
            }
          }
        } else if (target.metric === "leads") {
          const { data: leadsData } = await supabase
            .from("leads")
            .select("id")
            .in("agent_id", agentIds)
            .gte("created_at", start)
            .lte("created_at", end);

          actualValue = leadsData?.length || 0;
        }

        const percentageAchieved =
          target.target_value > 0
            ? (actualValue / target.target_value) * 100
            : 0;

        // If now above threshold, mark for resolution
        if (percentageAchieved >= target.threshold_percentage) {
          alertsToResolve.push(alert.id);
        }
      }
    }

    // Resolve alerts
    let alertsResolved = 0;
    if (alertsToResolve.length > 0) {
      const { error: resolveError } = await supabase
        .from("performance_alerts")
        .update({ alert_status: "resolved" })
        .in("id", alertsToResolve);

      if (!resolveError) {
        alertsResolved = alertsToResolve.length;
      }
    }

    console.log(
      `Performance check complete: ${alertsCreated} alerts created, ${alertsResolved} auto-resolved`
    );

    return new Response(
      JSON.stringify({
        message: "Performance check complete",
        targets_checked: targets.length,
        alerts_created: alertsCreated,
        alerts_resolved: alertsResolved,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in check-performance-alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
