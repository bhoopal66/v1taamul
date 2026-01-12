import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subDays, getDay, getHours, startOfWeek, startOfMonth } from 'date-fns';

export type HeatmapPeriod = 'weekly' | 'monthly';

export interface HourlyHeatmapCell {
  day: number; // 0-6 (Sun-Sat)
  hour: number; // 8-20
  value: number;
}

export const useHourlyCallHeatmap = (period: HeatmapPeriod = 'weekly') => {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hourly-call-heatmap', user?.id, period],
    queryFn: async (): Promise<HourlyHeatmapCell[]> => {
      let startDate: Date;
      
      if (period === 'weekly') {
        startDate = startOfWeek(new Date(), { weekStartsOn: 0 });
      } else {
        startDate = startOfMonth(new Date());
      }
      
      const { data: calls, error } = await supabase
        .from('call_feedback')
        .select('call_timestamp')
        .eq('agent_id', user?.id)
        .gte('call_timestamp', startDate.toISOString());

      if (error) throw error;

      // Initialize heatmap grid
      const heatmap: Map<string, number> = new Map();
      for (let day = 0; day < 7; day++) {
        for (let hour = 8; hour <= 20; hour++) {
          heatmap.set(`${day}-${hour}`, 0);
        }
      }

      // Aggregate calls by day and hour
      calls?.forEach(call => {
        if (call.call_timestamp) {
          const date = new Date(call.call_timestamp);
          const day = getDay(date);
          const hour = getHours(date);
          if (hour >= 8 && hour <= 20) {
            const key = `${day}-${hour}`;
            heatmap.set(key, (heatmap.get(key) || 0) + 1);
          }
        }
      });

      return Array.from(heatmap.entries()).map(([key, value]) => {
        const [day, hour] = key.split('-').map(Number);
        return { day, hour, value };
      });
    },
    enabled: !!user?.id,
  });

  return {
    heatmapData: data || [],
    isLoading,
    refetch,
  };
};
