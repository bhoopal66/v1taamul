import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMinutes, isBefore, isAfter, subMinutes } from 'date-fns';
import { toast } from 'sonner';

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

export type CallbackOutcome = 'interested' | 'not_interested' | 'not_answered' | 'wrong_number';

export const useCallbackReminders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  // Mark callback as completed with an outcome
  const completeCallback = useMutation({
    mutationFn: async ({ 
      feedbackId, 
      contactId, 
      outcome, 
      notes 
    }: { 
      feedbackId: string; 
      contactId: string; 
      outcome: CallbackOutcome; 
      notes?: string;
    }) => {
      // Insert new feedback with the outcome
      const { error: feedbackError } = await supabase
        .from('call_feedback')
        .insert({
          agent_id: user?.id,
          contact_id: contactId,
          feedback_status: outcome,
          notes: notes || null,
          call_timestamp: new Date().toISOString(),
        });

      if (feedbackError) throw feedbackError;

      // Update contact status based on outcome
      let contactStatus: 'contacted' | 'interested' | 'not_interested' = 'contacted';
      if (outcome === 'interested') contactStatus = 'interested';
      if (outcome === 'not_interested') contactStatus = 'not_interested';

      await supabase
        .from('master_contacts')
        .update({ status: contactStatus })
        .eq('id', contactId);

      // If interested, create a lead
      if (outcome === 'interested') {
        await supabase
          .from('leads')
          .insert({
            agent_id: user?.id,
            contact_id: contactId,
            lead_status: 'new',
            notes: notes || 'Converted from callback',
          });
      }

      // Clear the callback_datetime from the original callback feedback
      await supabase
        .from('call_feedback')
        .update({ callback_datetime: null })
        .eq('id', feedbackId);
    },
    onSuccess: (_, variables) => {
      const outcomeLabels: Record<CallbackOutcome, string> = {
        interested: '🎯 Marked as Interested!',
        not_interested: 'Marked as Not Interested',
        not_answered: 'Marked as Not Answered',
        wrong_number: 'Marked as Wrong Number',
      };
      toast.success(outcomeLabels[variables.outcome]);
      queryClient.invalidateQueries({ queryKey: ['callback-reminders'] });
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error) => {
      toast.error(`Failed to complete callback: ${error.message}`);
    },
  });

  // Reschedule callback to a new date/time
  const rescheduleCallback = useMutation({
    mutationFn: async ({ 
      feedbackId, 
      newDatetime 
    }: { 
      feedbackId: string; 
      newDatetime: Date;
    }) => {
      const { error } = await supabase
        .from('call_feedback')
        .update({ callback_datetime: newDatetime.toISOString() })
        .eq('id', feedbackId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('📅 Callback rescheduled');
      queryClient.invalidateQueries({ queryKey: ['callback-reminders'] });
    },
    onError: (error) => {
      toast.error(`Failed to reschedule: ${error.message}`);
    },
  });

  // Dismiss/cancel a callback
  const dismissCallback = useMutation({
    mutationFn: async (feedbackId: string) => {
      const { error } = await supabase
        .from('call_feedback')
        .update({ callback_datetime: null })
        .eq('id', feedbackId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Callback dismissed');
      queryClient.invalidateQueries({ queryKey: ['callback-reminders'] });
    },
    onError: (error) => {
      toast.error(`Failed to dismiss: ${error.message}`);
    },
  });

  const upcomingCount = reminders.filter(r => r.isUpcoming).length;
  const overdueCount = reminders.filter(r => r.isOverdue).length;

  return {
    reminders,
    upcomingCount,
    overdueCount,
    isLoading,
    refetch,
    completeCallback: completeCallback.mutate,
    isCompleting: completeCallback.isPending,
    rescheduleCallback: rescheduleCallback.mutate,
    isRescheduling: rescheduleCallback.isPending,
    dismissCallback: dismissCallback.mutate,
    isDismissing: dismissCallback.isPending,
  };
};
