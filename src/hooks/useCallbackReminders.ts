import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMinutes, isBefore, isAfter, subMinutes } from 'date-fns';

export interface CallbackReminder {
  id: string;
  contactId: string;
  companyName: string;
  contactPersonName: string;
  phoneNumber: string;
  callbackDatetime: Date;
  notes: string | null;
  isOverdue: boolean;
  isUpcoming: boolean; // Within next 15 minutes
}

export const useCallbackReminders = () => {
  const { user } = useAuth();

  const { data: reminders = [], isLoading, refetch } = useQuery({
    queryKey: ['callback-reminders', user?.id],
    queryFn: async (): Promise<CallbackReminder[]> => {
      const now = new Date();
      
      // Get all pending callbacks (where callback_datetime is in the future or slightly past)
      const { data: feedbackData, error } = await supabase
        .from('call_feedback')
        .select(`
          id,
          contact_id,
          callback_datetime,
          notes,
          master_contacts (
            company_name,
            contact_person_name,
            phone_number
          )
        `)
        .eq('agent_id', user?.id)
        .eq('feedback_status', 'callback')
        .not('callback_datetime', 'is', null)
        .gte('callback_datetime', subMinutes(now, 60).toISOString()) // Include callbacks from last hour (overdue)
        .order('callback_datetime', { ascending: true });

      if (error) throw error;

      return (feedbackData || []).map((item: any) => {
        const callbackTime = new Date(item.callback_datetime);
        const fifteenMinsFromNow = addMinutes(now, 15);
        
        return {
          id: item.id,
          contactId: item.contact_id,
          companyName: item.master_contacts?.company_name || 'Unknown',
          contactPersonName: item.master_contacts?.contact_person_name || 'Unknown',
          phoneNumber: item.master_contacts?.phone_number || '',
          callbackDatetime: callbackTime,
          notes: item.notes,
          isOverdue: isBefore(callbackTime, now),
          isUpcoming: isAfter(callbackTime, now) && isBefore(callbackTime, fifteenMinsFromNow),
        };
      });
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refetch every minute
  });

  const upcomingCount = reminders.filter(r => r.isUpcoming).length;
  const overdueCount = reminders.filter(r => r.isOverdue).length;

  return {
    reminders,
    upcomingCount,
    overdueCount,
    isLoading,
    refetch,
  };
};
