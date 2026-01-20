import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield, AlertTriangle, PhoneMissed, Activity, UserCheck, Bell } from 'lucide-react';
import { TeamStatsCards } from '@/components/supervisor/TeamStatsCards';
import { AgentPerformanceTable } from '@/components/supervisor/AgentPerformanceTable';
import { UploadApprovalQueue } from '@/components/supervisor/UploadApprovalQueue';
import { TeamPerformanceChart } from '@/components/supervisor/TeamPerformanceChart';
import { TeamTrendsLineChart } from '@/components/supervisor/TeamTrendsLineChart';
import { TeamConversionAreaChart } from '@/components/supervisor/TeamConversionAreaChart';
import { TeamTrendsSummaryCards } from '@/components/supervisor/TeamTrendsSummaryCards';
import { PerformanceComparisonView } from '@/components/supervisor/PerformanceComparisonView';
import { AgentDrillDownChart } from '@/components/supervisor/AgentDrillDownChart';
import { TeamSubmissionsView } from '@/components/supervisor/TeamSubmissionsView';
import { UnansweredCallsReport } from '@/components/supervisor/UnansweredCallsReport';
import { TeamActivityMonitor } from '@/components/supervisor/TeamActivityMonitor';
import { TeamWorkingStatusPanel } from '@/components/supervisor/TeamWorkingStatusPanel';
import { SupervisorAlertsPanel } from '@/components/supervisor/SupervisorAlertsPanel';
import { useSupervisorData } from '@/hooks/useSupervisorData';
import { useTeamPerformanceTrends } from '@/hooks/useTeamPerformanceTrends';
import { useTeamActivityMonitor } from '@/hooks/useTeamActivityMonitor';
import { useTeamWorkingStatus } from '@/hooks/useTeamWorkingStatus';
import { useSupervisorAlerts } from '@/hooks/useSupervisorAlerts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const SupervisorDashboard: React.FC = () => {
  const { profile, userRole, ledTeamId, user } = useAuth();
  const [trendDays, setTrendDays] = useState<number>(14);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');

  // Check if user can see all teams (admin, super_admin, operations_head)
  const canSeeAllTeams = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');

  // Fetch teams for the filter - scope based on role
  const { data: teams } = useQuery({
    queryKey: ['supervisor-teams', ledTeamId, canSeeAllTeams, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('teams')
        .select('id, name, team_type')
        .order('name');
      
      // If supervisor role and has a led team, only show their team
      if (!canSeeAllTeams && ledTeamId) {
        query = query.eq('id', ledTeamId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Determine effective team filter
  const effectiveTeamId = selectedTeamId === 'all' 
    ? (canSeeAllTeams ? undefined : ledTeamId || undefined)
    : selectedTeamId;

  const {
    teamPerformance,
    pendingUploads,
    teamStats,
    isLoading,
    isSupervisor,
    approveUpload,
    rejectUpload,
    refetch,
  } = useSupervisorData(effectiveTeamId);

  const {
    dailyTrends,
    summary: trendSummary,
    isLoading: trendsLoading,
    refetch: refetchTrends,
  } = useTeamPerformanceTrends({ days: trendDays, teamId: effectiveTeamId });

  const {
    teamActivity,
    teamStats: activityStats,
    isLoading: activityLoading,
  } = useTeamActivityMonitor({ teamId: effectiveTeamId });

  const {
    teamStatus,
    stats: workingStats,
    isLoading: workingStatusLoading,
    refetch: refetchWorkingStatus,
  } = useTeamWorkingStatus(effectiveTeamId);

  const {
    alerts,
    unreadCount,
    isLoading: alertsLoading,
    markAsRead,
    markAllAsRead,
    refetch: refetchAlerts,
  } = useSupervisorAlerts();

  const handleRefresh = () => {
    refetch();
    refetchTrends();
    refetchWorkingStatus();
    refetchAlerts();
  };

  if (!isSupervisor) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to view this page. This dashboard is only available to supervisors and above.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);
  
  // Determine display name for team
  const teamDisplayName = selectedTeamId === 'all' 
    ? (canSeeAllTeams ? 'All Teams' : (teams?.[0]?.name || 'Your Team'))
    : (selectedTeam?.name || 'Team');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Team Overview
            </h1>
            <p className="text-muted-foreground mt-1">
              {teamDisplayName} • {profile?.full_name || 'Supervisor'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Team Filter - Only show if user can see multiple teams */}
          {canSeeAllTeams && (
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading || trendsLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || trendsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Today's Stats Cards */}
      <TeamStatsCards stats={teamStats} isLoading={isLoading} />

      {/* Upload Approval Queue - Show prominently if there are pending uploads */}
      {pendingUploads.length > 0 && (
        <UploadApprovalQueue
          data={pendingUploads}
          isLoading={isLoading}
          onApprove={approveUpload}
          onReject={rejectUpload}
        />
      )}

      {/* Performance Tabs */}
      <Tabs defaultValue="working-status" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="working-status" className="gap-1">
              <UserCheck className="w-4 h-4" />
              Working Status
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1">
              <Bell className="w-4 h-4" />
              Alerts
              {unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1">
              <Activity className="w-4 h-4" />
              Live Activity
            </TabsTrigger>
            <TabsTrigger value="trends">Team Trends</TabsTrigger>
            <TabsTrigger value="unanswered" className="gap-1">
              <PhoneMissed className="w-4 h-4" />
              Unanswered
            </TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="agents">Agent Drill-Down</TabsTrigger>
            <TabsTrigger value="comparison">Compare Periods</TabsTrigger>
            <TabsTrigger value="today">Today's Activity</TabsTrigger>
          </TabsList>
          
          <Select value={trendDays.toString()} onValueChange={(v) => setTrendDays(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="working-status" className="space-y-6">
          <TeamWorkingStatusPanel 
            teamStatus={teamStatus} 
            stats={workingStats} 
            isLoading={workingStatusLoading} 
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <SupervisorAlertsPanel 
            alerts={alerts} 
            unreadCount={unreadCount} 
            isLoading={alertsLoading}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <TeamActivityMonitor 
            teamActivity={teamActivity} 
            teamStats={activityStats} 
            isLoading={activityLoading} 
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Trend Summary Cards */}
          <TeamTrendsSummaryCards summary={trendSummary} isLoading={trendsLoading} days={trendDays} />
          
          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamTrendsLineChart
              data={dailyTrends}
              isLoading={trendsLoading}
              trend={trendSummary.trend}
              trendPercentage={trendSummary.trendPercentage}
            />
            <TeamConversionAreaChart data={dailyTrends} isLoading={trendsLoading} />
          </div>
        </TabsContent>

        <TabsContent value="unanswered" className="space-y-6">
          <UnansweredCallsReport teamId={effectiveTeamId} />
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6">
          <TeamSubmissionsView />
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <AgentDrillDownChart />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <PerformanceComparisonView />
        </TabsContent>

        <TabsContent value="today" className="space-y-6">
          {/* Today's Performance Chart */}
          <TeamPerformanceChart data={teamPerformance} isLoading={isLoading} />
          
          {/* Agent Performance Table */}
          <AgentPerformanceTable data={teamPerformance} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      {/* Upload Queue at bottom if no pending */}
      {pendingUploads.length === 0 && (
        <UploadApprovalQueue
          data={pendingUploads}
          isLoading={isLoading}
          onApprove={approveUpload}
          onReject={rejectUpload}
        />
      )}
    </div>
  );
};