import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TalkTimeEntry {
  id: string;
  agent_id: string;
  date: string;
  talk_time_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useTalkTime = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: todayTalkTime, isLoading: todayLoading } = useQuery({
    queryKey: ['talk-time-today', user?.id],
    queryFn: async () => {
      return api.get<TalkTimeEntry | null>('/talktime/today');
    },
    enabled: !!user,
  });

  const { data: recentEntries, isLoading: recentLoading } = useQuery({
    queryKey: ['talk-time-recent', user?.id],
    queryFn: async () => {
      return api.get<TalkTimeEntry[]>('/talktime/recent');
    },
    enabled: !!user,
  });

  const submitTalkTime = useMutation({
    mutationFn: async ({ minutes, notes, date }: { minutes: number; notes?: string; date?: string }) => {
      return api.post('/talktime', { minutes, notes, date });
    },
    onSuccess: () => {
      toast.success('Talk time saved successfully');
      queryClient.invalidateQueries({ queryKey: ['talk-time-today'] });
      queryClient.invalidateQueries({ queryKey: ['talk-time-recent'] });
    },
    onError: (error: any) => {
      toast.error('Failed to save talk time: ' + error.message);
    },
  });

  const { data: monthlyTotal } = useQuery({
    queryKey: ['talk-time-monthly', user?.id],
    queryFn: async () => {
      return api.get<{ total: number }>('/talktime/monthly');
    },
    enabled: !!user,
  });

  return {
    todayTalkTime,
    recentEntries: recentEntries || [],
    monthlyTotal: monthlyTotal?.total || 0,
    isLoading: todayLoading || recentLoading,
    submitTalkTime,
  };
};
