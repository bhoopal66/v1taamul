import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { TeamStatsCards } from '@/components/supervisor/TeamStatsCards';
import { AgentPerformanceTable } from '@/components/supervisor/AgentPerformanceTable';
import { UploadApprovalQueue } from '@/components/supervisor/UploadApprovalQueue';
import { TeamPerformanceChart } from '@/components/supervisor/TeamPerformanceChart';
import { useSupervisorData } from '@/hooks/useSupervisorData';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const SupervisorDashboard: React.FC = () => {
  const { profile, userRole } = useAuth();
  const {
    teamPerformance,
    pendingUploads,
    teamStats,
    isLoading,
    isSupervisor,
    approveUpload,
    rejectUpload,
    refetch,
  } = useSupervisorData();

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
              Supervisor Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Team overview and management • {profile?.full_name || 'Supervisor'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={refetch}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Stats Cards */}
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

      {/* Team Performance Chart */}
      <TeamPerformanceChart data={teamPerformance} isLoading={isLoading} />

      {/* Agent Performance Table */}
      <AgentPerformanceTable data={teamPerformance} isLoading={isLoading} />

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
