import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ActivityType = 
  | 'call_interested'
  | 'call_not_interested'
  | 'call_not_answered'
  | 'call_callback'
  | 'call_wrong_number'
  | 'lead_created'
  | 'status_change'
  | 'note_added'
  | 'whatsapp_sent';

export interface LeadActivity {
  id: string;
  type: ActivityType;
  timestamp: string;
  description: string;
  notes?: string | null;
  metadata?: {
    fromStatus?: string;
    toStatus?: string;
    feedbackStatus?: string;
  };
}

const getFeedbackActivityType = (status: string): ActivityType => {
  const mapping: Record<string, ActivityType> = {
    'interested': 'call_interested',
    'not_interested': 'call_not_interested',
    'not_answered': 'call_not_answered',
    'callback': 'call_callback',
    'wrong_number': 'call_wrong_number',
  };
  return mapping[status] || 'call_not_answered';
};

const getFeedbackDescription = (status: string): string => {
  const descriptions: Record<string, string> = {
    'interested': 'Marked as interested during call',
    'not_interested': 'Marked as not interested',
    'not_answered': 'Call not answered',
    'callback': 'Callback scheduled',
    'wrong_number': 'Wrong number reported',
  };
  return descriptions[status] || 'Call feedback recorded';
};

export const useLeadActivity = (contactId: string | null) => {
  const { user } = useAuth();

  const { data: activities, isLoading, refetch } = useQuery({
    queryKey: ['lead-activity', contactId, user?.id],
    queryFn: async (): Promise<LeadActivity[]> => {
      if (!contactId) return [];

      const allActivities: LeadActivity[] = [];

      // Fetch call feedback history
      const { data: feedback, error: feedbackError } = await supabase
        .from('call_feedback')
        .select('*')
        .eq('contact_id', contactId)
        .order('call_timestamp', { ascending: false });

      if (feedbackError) throw feedbackError;

      feedback?.forEach(f => {
        allActivities.push({
          id: `feedback-${f.id}`,
          type: getFeedbackActivityType(f.feedback_status),
          timestamp: f.call_timestamp || f.created_at || '',
          description: getFeedbackDescription(f.feedback_status),
          notes: f.notes,
          metadata: {
            feedbackStatus: f.feedback_status,
          },
        });

        // Add WhatsApp sent activity if applicable
        if (f.whatsapp_sent) {
          allActivities.push({
            id: `whatsapp-${f.id}`,
            type: 'whatsapp_sent',
            timestamp: f.call_timestamp || f.created_at || '',
            description: 'WhatsApp message sent',
          });
        }
      });

      // Fetch contact history
      const { data: history, error: historyError } = await supabase
        .from('contact_history')
        .select('*')
        .eq('contact_id', contactId)
        .order('action_date', { ascending: false });

      if (historyError) throw historyError;

      history?.forEach(h => {
        let type: ActivityType = 'status_change';
        let description = 'Activity recorded';

        const actionType = h.action_type as string;
        
        if (actionType === 'status_change' || actionType === 'reassign') {
          type = 'status_change';
          description = actionType === 'reassign' ? 'Lead reassigned' : 'Lead status updated';
        } else if (actionType === 'feedback') {
          type = getFeedbackActivityType(h.feedback_status || '');
          description = getFeedbackDescription(h.feedback_status || '');
        } else if (actionType === 'call') {
          type = getFeedbackActivityType(h.feedback_status || '');
          description = getFeedbackDescription(h.feedback_status || '');
        } else if (actionType === 'upload') {
          type = 'note_added';
          description = 'Contact uploaded';
        }

        allActivities.push({
          id: `history-${h.id}`,
          type,
          timestamp: h.action_date || h.created_at || '',
          description,
          notes: h.notes,
          metadata: {
            feedbackStatus: h.feedback_status || undefined,
          },
        });
      });

      // Fetch lead creation date
      const { data: lead } = await supabase
        .from('leads')
        .select('id, created_at, lead_status')
        .eq('contact_id', contactId)
        .maybeSingle();

      if (lead) {
        allActivities.push({
          id: `lead-created-${lead.id}`,
          type: 'lead_created',
          timestamp: lead.created_at || '',
          description: 'Lead created from interested call',
        });
      }

      // Sort by timestamp descending
      return allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
    enabled: !!contactId && !!user?.id,
  });

  return {
    activities: activities || [],
    isLoading,
    refetch,
  };
};
