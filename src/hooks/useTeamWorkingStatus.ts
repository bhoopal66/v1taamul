import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface AgentWorkingStatus {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  role: string | null;
  isWorking: boolean;
  currentActivity: string | null;
  currentActivityStartedAt: string | null;
  sessionStartTime: string | null;
  endReason: string | null;
  lastConfirmationAt: string | null;
  missedConfirmations: number;
}

export interface TeamWorkingStats {
  total: number;
  working: number;
  notWorking: number;
  autoLogout: number;
  marketVisit: number;
  manualLogout: number;
  onBreak: number;
  notStarted: number;
  loggedInNotStarted: number; // Logged in but haven't pressed START
  fiveMinAutoLogout: number; // Cold Calling / Client Meeting 5-min rule
}

export function useTeamWorkingStatus(teamId?: string) {
  const { user, userRole, ledTeamId } = useAuth();
  const queryClient = useQueryClient();
  
  const canSeeAllTeams = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = teamId || (!canSeeAllTeams ? ledTeamId : undefined);

  const today = new Date().toISOString().split('T')[0];

  const { data: teamStatus = [], isLoading, refetch } = useQuery({
    queryKey: ['team-working-status', effectiveTeamId, today, user?.id],
    queryFn: async (): Promise<AgentWorkingStatus[]> => {
      // Get team members
      let membersQuery = supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, team_id')
        .eq('is_active', true);
      
      if (effectiveTeamId) {
        membersQuery = membersQuery.eq('team_id', effectiveTeamId);
      }
      
      const { data: members, error: membersError } = await membersQuery;
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const memberIds = members.map(m => m.id);

      // Get roles for all team members
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', memberIds);

      if (rolesError) throw rolesError;

      // Get today's sessions for all team members
      const { data: sessions, error: sessionsError } = await supabase
        .from('activity_sessions')
        .select('*')
        .in('user_id', memberIds)
        .eq('date', today);

      if (sessionsError) throw sessionsError;

      // Map members to their working status
      return members.map(member => {
        const session = sessions?.find(s => s.user_id === member.id);
        const userRole = roles?.find(r => r.user_id === member.id)?.role || 'agent';
        
        return {
          userId: member.id,
          fullName: member.full_name || 'Unknown',
          username: member.username || member.id.slice(0, 8),
          avatarUrl: member.avatar_url,
          role: userRole,
          isWorking: session?.is_active ?? false,
          currentActivity: session?.current_activity || null,
          currentActivityStartedAt: session?.current_activity_started_at || null,
          sessionStartTime: session?.start_time || null,
          endReason: session?.end_reason || null,
          lastConfirmationAt: session?.last_confirmation_at || null,
          missedConfirmations: session?.missed_confirmations ?? 0,
        };
      });
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Subscribe to realtime updates for activity_sessions
  useEffect(() => {
    const channel = supabase
      .channel('team-sessions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_sessions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['team-working-status'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Calculate stats
  const stats: TeamWorkingStats = {
    total: teamStatus.length,
    working: teamStatus.filter(a => a.isWorking).length,
    notWorking: teamStatus.filter(a => !a.isWorking).length,
    autoLogout: teamStatus.filter(a => !a.isWorking && a.endReason === 'auto_logout_missed_confirmations').length,
    marketVisit: teamStatus.filter(a => !a.isWorking && a.endReason === 'market_visit').length,
    manualLogout: teamStatus.filter(a => !a.isWorking && a.endReason === 'manual_logout').length,
    onBreak: teamStatus.filter(a => a.isWorking && a.currentActivity === 'break').length,
    notStarted: teamStatus.filter(a => !a.isWorking && !a.endReason && !a.sessionStartTime).length,
    loggedInNotStarted: teamStatus.filter(a => !a.isWorking && !a.sessionStartTime).length, // Has session row but no start_time
    fiveMinAutoLogout: teamStatus.filter(a => !a.isWorking && a.endReason?.startsWith('auto_logout_5min_')).length,
  };

  return {
    teamStatus,
    stats,
    isLoading,
    refetch,
  };
}
