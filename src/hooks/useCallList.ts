import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

  const { data: callList, isLoading, refetch } = useQuery({
    queryKey: ['call-list', user?.id, today.toDateString()],
    queryFn: async (): Promise<CallListContact[]> => {
      const dateStr = today.toISOString().split('T')[0];
      return api.get<CallListContact[]>('/calls/list', { date: dateStr });
    },
    enabled: !!user?.id,
  });

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
      return api.post('/calls/feedback', { callListId, contactId, status, notes });
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
    onError: (error: any) => {
      toast.error(`Failed to log call: ${error.message}`);
    },
  });

  const skipContact = useMutation({
    mutationFn: async (callListId: string) => {
      return api.post(`/calls/${callListId}/skip`, {});
    },
    onSuccess: () => {
      toast.success('Contact skipped');
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to skip: ${error.message}`);
    },
  });

  const bulkUpdateArea = useMutation({
    mutationFn: async ({ contactIds, area }: { contactIds: string[]; area: string }) => {
      return api.post('/calls/bulk-update-area', { contactIds, area });
    },
    onSuccess: (_, variables) => {
      toast.success(`Updated area for ${variables.contactIds.length} contacts`);
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update area: ${error.message}`);
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
    bulkUpdateArea: bulkUpdateArea.mutate,
    isBulkUpdating: bulkUpdateArea.isPending,
  };
};
