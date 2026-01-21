import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lightweight hook to check if user has an active session today
 * Used for navigation guards - doesn't need all the session management logic
 */
export function useActivitySessionStatus() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['activity-session-status', user?.id],
    queryFn: async ({ signal }) => {
      if (!user?.id) return { hasStarted: false, isActive: false };

      // Prevent infinite "Loading..." if the backend is slow/unreachable.
      // We treat timeouts as aborts and return a safe default.
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener?.('abort', onAbort);
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: session, error } = await supabase
          .from('activity_sessions')
          .select('start_time, is_active')
          .eq('user_id', user.id)
          .eq('date', today)
          .abortSignal(controller.signal)
          .maybeSingle();
        
        if (error) {
          // Ignore abort errors - they're expected when component unmounts / timeout
          if (error.message?.toLowerCase?.().includes('abort') || error.code === 'AbortError') {
            return { hasStarted: false, isActive: false };
          }
          console.error('Error checking session status:', error);
          return { hasStarted: false, isActive: false };
        }

        return {
          hasStarted: !!session?.start_time,
          isActive: session?.is_active && !!session?.start_time,
        };
      } catch (e: any) {
        const message = e?.message || String(e);
        if (message.toLowerCase().includes('abort')) {
          return { hasStarted: false, isActive: false };
        }
        console.error('Error checking session status:', e);
        return { hasStarted: false, isActive: false };
      } finally {
        window.clearTimeout(timeoutId);
        signal?.removeEventListener?.('abort', onAbort);
      }
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Reduced frequency: 10 seconds instead of 5
    staleTime: 5000,
    retry: (failureCount, error) => {
      // Don't retry on abort errors
      if (error?.message?.includes('abort')) return false;
      return failureCount < 2;
    },
  });

  return {
    hasStarted: data?.hasStarted ?? false,
    isActive: data?.isActive ?? false,
    isLoading,
  };
}
