import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';

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

  // Fetch today's talk time
  const { data: todayTalkTime, isLoading: todayLoading } = useQuery({
    queryKey: ['talk-time-today', user?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('agent_talk_time')
        .select('*')
        .eq('agent_id', user!.id)
        .eq('date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as TalkTimeEntry | null;
    },
    enabled: !!user,
  });

  // Fetch recent talk time entries (last 7 days)
  const { data: recentEntries, isLoading: recentLoading } = useQuery({
    queryKey: ['talk-time-recent', user?.id],
    queryFn: async () => {
      const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('agent_talk_time')
        .select('*')
        .eq('agent_id', user!.id)
        .gte('date', startDate)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as TalkTimeEntry[];
    },
    enabled: !!user,
  });

  // Submit or update talk time
  const submitTalkTime = useMutation({
    mutationFn: async ({ minutes, notes, date }: { minutes: number; notes?: string; date?: string }) => {
      const targetDate = date || format(new Date(), 'yyyy-MM-dd');
      
      // Check if entry exists for this date
      const { data: existing } = await supabase
        .from('agent_talk_time')
        .select('id')
        .eq('agent_id', user!.id)
        .eq('date', targetDate)
        .maybeSingle();

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from('agent_talk_time')
          .update({ 
            talk_time_minutes: minutes, 
            notes: notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('agent_talk_time')
          .insert({
            agent_id: user!.id,
            date: targetDate,
            talk_time_minutes: minutes,
            notes: notes || null,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Talk time saved successfully');
      queryClient.invalidateQueries({ queryKey: ['talk-time-today'] });
      queryClient.invalidateQueries({ queryKey: ['talk-time-recent'] });
    },
    onError: (error) => {
      toast.error('Failed to save talk time: ' + error.message);
    },
  });

  // Calculate monthly total
  const { data: monthlyTotal } = useQuery({
    queryKey: ['talk-time-monthly', user?.id],
    queryFn: async () => {
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('agent_talk_time')
        .select('talk_time_minutes')
        .eq('agent_id', user!.id)
        .gte('date', start)
        .lte('date', end);
      
      if (error) throw error;
      return data?.reduce((sum, entry) => sum + entry.talk_time_minutes, 0) || 0;
    },
    enabled: !!user,
  });

  return {
    todayTalkTime,
    recentEntries: recentEntries || [],
    monthlyTotal: monthlyTotal || 0,
    isLoading: todayLoading || recentLoading,
    submitTalkTime,
  };
};
