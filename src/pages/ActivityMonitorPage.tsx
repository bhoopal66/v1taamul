import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityMonitor, ACTIVITY_LABELS } from '@/hooks/useActivityMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivitySelector } from '@/components/activity/ActivitySelector';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { AttendanceCard } from '@/components/activity/AttendanceCard';
import { IdleAlertsBanner } from '@/components/activity/IdleAlertsBanner';
import { CallingStatsCard } from '@/components/activity/CallingStatsCard';
import { Activity, Clock } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export const ActivityMonitorPage: React.FC = () => {
  const { profile } = useAuth();
  const {
    currentActivity,
    todayLogs,
    attendance,
    idleAlerts,
    callingStats,
    breakStatus,
    withinWorkHours,
    isLoading,
    isSwitching,
    switchActivity,
    acknowledgeAlert,
  } = useActivityMonitor();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Activity className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Monitor</h1>
          <p className="text-muted-foreground">
            {profile?.full_name || 'Agent'} • Track your daily activities
          </p>
        </div>
      </div>

      {/* Idle Alerts */}
      <IdleAlertsBanner alerts={idleAlerts} onAcknowledge={acknowledgeAlert} />

      {/* Activity Selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Current Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivitySelector
            currentActivity={currentActivity?.activity_type || null}
            onActivityChange={switchActivity}
            disabled={isSwitching}
            isOnBreak={breakStatus.onBreak}
            breakLabel={breakStatus.breakLabel}
          />
          {!withinWorkHours && (
            <p className="text-sm text-muted-foreground mt-2">
              ⏰ Outside work hours (10:00 AM - 7:00 PM Dubai time)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AttendanceCard attendance={attendance} />
        <CallingStatsCard stats={callingStats} />
        <ActivityTimeline logs={todayLogs} compact />
      </div>

      {/* Full Timeline */}
      <ActivityTimeline logs={todayLogs} />
    </div>
  );
};

export default ActivityMonitorPage;
