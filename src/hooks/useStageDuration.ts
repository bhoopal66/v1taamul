import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LeadStatus } from './useLeads';

export interface StageDuration {
  stage: LeadStatus;
  label: string;
  avgDurationHours: number;
  avgDurationFormatted: string;
  count: number;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'In Progress',
  qualified: 'Submitted',
  converted: 'Assessing',
  approved: 'Approved',
  lost: 'Lost',
};

const formatDuration = (hours: number): string => {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  if (days < 7) {
    return `${days.toFixed(1)}d`;
  }
  const weeks = days / 7;
  return `${weeks.toFixed(1)}w`;
};

export const useStageDuration = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['stage-duration', user?.id],
    queryFn: async (): Promise<StageDuration[]> => {
      if (!user?.id) return [];

      // Get all leads for this agent
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id')
        .eq('agent_id', user.id);

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) return [];

      const leadIds = leads.map(l => l.id);

      // Get all transitions for these leads
      const { data: transitions, error } = await supabase
        .from('lead_stage_transitions')
        .select('lead_id, from_status, to_status, changed_at')
        .in('lead_id', leadIds)
        .order('changed_at', { ascending: true });

      if (error) throw error;
      if (!transitions || transitions.length === 0) return [];

      // Group transitions by lead
      const transitionsByLead: Record<string, typeof transitions> = {};
      transitions.forEach(t => {
        if (!transitionsByLead[t.lead_id]) {
          transitionsByLead[t.lead_id] = [];
        }
        transitionsByLead[t.lead_id].push(t);
      });

      // Calculate time spent in each stage
      const stageDurations: Record<LeadStatus, number[]> = {
        new: [],
        contacted: [],
        qualified: [],
        converted: [],
        approved: [],
        lost: [],
      };

      Object.values(transitionsByLead).forEach(leadTransitions => {
        // Sort by time
        const sorted = [...leadTransitions].sort(
          (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
        );

        for (let i = 0; i < sorted.length; i++) {
          const transition = sorted[i];
          const nextTransition = sorted[i + 1];

          // The stage that was entered at this transition
          const stage = transition.to_status as LeadStatus;
          
          if (nextTransition) {
            // Calculate time spent in this stage until next transition
            const enteredAt = new Date(transition.changed_at).getTime();
            const exitedAt = new Date(nextTransition.changed_at).getTime();
            const durationHours = (exitedAt - enteredAt) / (1000 * 60 * 60);
            
            if (durationHours > 0 && durationHours < 8760) { // Cap at 1 year
              stageDurations[stage].push(durationHours);
            }
          }
          // If no next transition, the lead is still in this stage - don't count it
        }
      });

      // Calculate averages
      const stages: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'approved', 'lost'];
      
      return stages.map(stage => {
        const durations = stageDurations[stage];
        const avgHours = durations.length > 0 
          ? durations.reduce((a, b) => a + b, 0) / durations.length 
          : 0;

        return {
          stage,
          label: STATUS_LABELS[stage],
          avgDurationHours: avgHours,
          avgDurationFormatted: avgHours > 0 ? formatDuration(avgHours) : '-',
          count: durations.length,
        };
      });
    },
    enabled: !!user?.id,
  });
};
