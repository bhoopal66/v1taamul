import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startOfDay, endOfDay } from 'date-fns';

export type FeedbackStatus = 'not_answered' | 'interested' | 'not_interested' | 'callback' | 'wrong_number';
export type CallStatus = 'pending' | 'called' | 'skipped';

export interface CallListContact {
  id: string;
  callListId: string;
  contactId: string;
  companyName: string;
  contactPersonName: string;
  phoneNumber: string;
  tradeLicenseNumber: string;
  city: string | null;
  industry: string | null;
  area: string | null;
  callOrder: number;
  callStatus: CallStatus;
  calledAt: string | null;
  lastFeedback: FeedbackStatus | null;
  lastNotes: string | null;
}

export interface CallListStats {
  total: number;
  pending: number;
  called: number;
  skipped: number;
  interested: number;
  notInterested: number;
  notAnswered: number;
  callback: number;
}

export const useCallList = (selectedDate?: Date) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = selectedDate || new Date();

  // Fetch today's call list with contact details
  const { data: callList, isLoading, refetch } = useQuery({
    queryKey: ['call-list', user?.id, today.toDateString()],
    queryFn: async (): Promise<CallListContact[]> => {
      const dateStr = today.toISOString().split('T')[0];

      // Fetch call list for today
      const { data: callListData, error: callListError } = await supabase
        .from('approved_call_list')
        .select('*')
        .eq('agent_id', user?.id)
        .eq('list_date', dateStr)
        .order('call_order', { ascending: true });

      if (callListError) throw callListError;

      if (!callListData || callListData.length === 0) {
        return [];
      }

      // Get contact IDs
      const contactIds = callListData.map(c => c.contact_id);

      // Fetch contact details
      const { data: contacts, error: contactsError } = await supabase
        .from('master_contacts')
        .select('*')
        .in('id', contactIds);

      if (contactsError) throw contactsError;

      // Fetch today's feedback for these contacts
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      const { data: feedback } = await supabase
        .from('call_feedback')
        .select('*')
        .eq('agent_id', user?.id)
        .in('contact_id', contactIds)
        .gte('call_timestamp', dayStart)
        .lte('call_timestamp', dayEnd)
        .order('call_timestamp', { ascending: false });

      // Create a map for quick lookup
      const contactMap = new Map(contacts?.map(c => [c.id, c]) || []);
      const feedbackMap = new Map<string, { status: FeedbackStatus; notes: string | null }>();
      
      // Get the latest feedback for each contact
      feedback?.forEach(f => {
        if (!feedbackMap.has(f.contact_id)) {
          feedbackMap.set(f.contact_id, { 
            status: f.feedback_status as FeedbackStatus, 
            notes: f.notes 
          });
        }
      });

      return callListData.map(item => {
        const contact = contactMap.get(item.contact_id);
        const fb = feedbackMap.get(item.contact_id);

        return {
          id: item.id,
          callListId: item.id,
          contactId: item.contact_id,
          companyName: contact?.company_name || 'Unknown',
          contactPersonName: contact?.contact_person_name || 'Unknown',
          phoneNumber: contact?.phone_number || '',
          tradeLicenseNumber: contact?.trade_license_number || '',
          city: contact?.city || null,
          industry: contact?.industry || null,
          area: (contact as { area?: string | null })?.area || null,
          callOrder: item.call_order,
          callStatus: item.call_status as CallStatus,
          calledAt: item.called_at,
          lastFeedback: fb?.status || null,
          lastNotes: fb?.notes || null,
        };
      });
    },
    enabled: !!user?.id,
  });

  // Calculate stats
  const stats: CallListStats = {
    total: callList?.length || 0,
    pending: callList?.filter(c => c.callStatus === 'pending').length || 0,
    called: callList?.filter(c => c.callStatus === 'called').length || 0,
    skipped: callList?.filter(c => c.callStatus === 'skipped').length || 0,
    interested: callList?.filter(c => c.lastFeedback === 'interested').length || 0,
    notInterested: callList?.filter(c => c.lastFeedback === 'not_interested').length || 0,
    notAnswered: callList?.filter(c => c.lastFeedback === 'not_answered').length || 0,
    callback: callList?.filter(c => c.lastFeedback === 'callback').length || 0,
  };

  // Log call feedback mutation
  const logFeedback = useMutation({
    mutationFn: async ({ 
      callListId, 
      contactId, 
      status, 
      notes 
    }: { 
      callListId: string; 
      contactId: string; 
      status: FeedbackStatus; 
      notes?: string;
    }) => {
      // Insert feedback
      const { error: feedbackError } = await supabase
        .from('call_feedback')
        .insert({
          agent_id: user?.id,
          contact_id: contactId,
          call_list_id: callListId,
          feedback_status: status,
          notes: notes || null,
          call_timestamp: new Date().toISOString(),
        });

      if (feedbackError) throw feedbackError;

      // Update call list item status
      const { error: updateError } = await supabase
        .from('approved_call_list')
        .update({
          call_status: 'called',
          called_at: new Date().toISOString(),
        })
        .eq('id', callListId);

      if (updateError) throw updateError;

      // Update contact status based on feedback
      let contactStatus: 'contacted' | 'interested' | 'not_interested' = 'contacted';
      if (status === 'interested') contactStatus = 'interested';
      if (status === 'not_interested') contactStatus = 'not_interested';

      await supabase
        .from('master_contacts')
        .update({ status: contactStatus })
        .eq('id', contactId);

      // If interested, create a lead
      if (status === 'interested') {
        await supabase
          .from('leads')
          .insert({
            agent_id: user?.id,
            contact_id: contactId,
            lead_status: 'new',
            notes: notes || null,
          });
      }
    },
    onSuccess: (_, variables) => {
      const statusLabels: Record<FeedbackStatus, string> = {
        interested: '🎯 Marked as Interested!',
        not_interested: 'Marked as Not Interested',
        not_answered: 'Marked as Not Answered',
        callback: '📅 Scheduled for Callback',
        wrong_number: 'Marked as Wrong Number',
      };
      toast.success(statusLabels[variables.status]);
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error) => {
      toast.error(`Failed to log call: ${error.message}`);
    },
  });

  // Skip contact mutation
  const skipContact = useMutation({
    mutationFn: async (callListId: string) => {
      const { error } = await supabase
        .from('approved_call_list')
        .update({ call_status: 'skipped' })
        .eq('id', callListId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Contact skipped');
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error) => {
      toast.error(`Failed to skip: ${error.message}`);
    },
  });

  return {
    callList: callList || [],
    stats,
    isLoading,
    refetch,
    logFeedback: logFeedback.mutate,
    isLogging: logFeedback.isPending,
    skipContact: skipContact.mutate,
    isSkipping: skipContact.isPending,
  };
};
