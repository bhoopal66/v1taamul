import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActivitySession, SimpleActivityType } from '@/hooks/useActivitySession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FullScreenClock } from '@/components/activity/FullScreenClock';
import { SimpleActivityPicker } from '@/components/activity/SimpleActivityPicker';
import { ActivityConfirmationPrompt } from '@/components/activity/ActivityConfirmationPrompt';
import { AttendanceCard } from '@/components/activity/AttendanceCard';
import { CallingStatsCard } from '@/components/activity/CallingStatsCard';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { FiveMinCountdownBanner } from '@/components/activity/FiveMinCountdownBanner';
import { IdleCountdownBanner } from '@/components/activity/IdleCountdownBanner';
import { MyAttendanceHistory } from '@/components/activity/MyAttendanceHistory';
import { useActivityMonitor } from '@/hooks/useActivityMonitor';
import { Activity, Clock, LogOut, CheckCircle2 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export const ActivityMonitorPage: React.FC = () => {
  const { profile } = useAuth();
  const {
    session,
    hasStarted,
    isSessionActive,
    dubaiTime,
    breakStatus,
    withinWorkHours,
    showConfirmationPrompt,
    graceTimeRemaining,
    fiveMinCountdown,
    idleCountdown,
    isLoading,
    isStarting,
    isSwitching,
    isConfirming,
    isEnding,
    startSession,
    switchActivity,
    confirmActivity,
    endSession,
  } = useActivitySession();

  // Also use old hook for legacy data (attendance, logs, calling stats)
  const {
    todayLogs,
    attendance,
    callingStats,
  } = useActivityMonitor();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show full-screen clock if session not started
  if (!hasStarted) {
    return (
      <FullScreenClock
        dubaiTime={dubaiTime}
        withinWorkHours={withinWorkHours}
        breakStatus={breakStatus}
        onStart={startSession}
        isStarting={isStarting}
        agentName={profile?.full_name}
      />
    );
  }

  // Show confirmation prompt if needed (blocks everything else)
  if (showConfirmationPrompt && isSessionActive) {
    return (
      <ActivityConfirmationPrompt
        currentActivity={session?.current_activity || null}
        graceTimeRemaining={graceTimeRemaining}
        onAccept={() => confirmActivity('accepted')}
        onChange={(activity: SimpleActivityType, details?: string) => 
          confirmActivity('changed', activity, details)
        }
        isLoading={isConfirming}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activity Monitor</h1>
            <p className="text-muted-foreground">
              {profile?.full_name || 'Agent'} • {format(dubaiTime, 'EEEE, MMM d')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Session Status */}
          {isSessionActive ? (
            <Badge className="gap-1 bg-green-600">
              <CheckCircle2 className="w-3 h-3" />
              Working
            </Badge>
          ) : (
            <Badge variant="secondary">Not Working</Badge>
          )}
          
          {/* Current Time */}
          <div className="text-right">
            <p className="text-2xl font-mono font-bold tabular-nums">
              {format(dubaiTime, 'HH:mm:ss')}
            </p>
            <p className="text-xs text-muted-foreground">Dubai Time</p>
          </div>

          {/* End Session Button */}
          {isSessionActive && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={endSession}
              disabled={isEnding}
              className="gap-1"
            >
              <LogOut className="w-4 h-4" />
              End Session
            </Button>
          )}
        </div>
      </div>

      {/* Session not active warning */}
      {!isSessionActive && session?.end_reason && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-700">Session Ended</p>
                <p className="text-sm text-muted-foreground">
                  Reason: {session.end_reason.replace(/_/g, ' ')}. 
                  Press START on the clock screen to begin a new session.
                </p>
              </div>
              <Button 
                className="ml-auto"
                onClick={startSession}
                disabled={isStarting || breakStatus.onBreak}
              >
                Restart Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 15-Minute Idle/Inactivity Countdown Banner */}
      {isSessionActive && idleCountdown && idleCountdown.isActive && (
        <IdleCountdownBanner
          remainingSeconds={idleCountdown.remainingSeconds}
          hasActivity={idleCountdown.hasActivity}
        />
      )}

      {/* 10-Minute Countdown Banner for Cold Calling / Meeting */}
      {isSessionActive && fiveMinCountdown && fiveMinCountdown.isActive && (
        <FiveMinCountdownBanner
          remainingSeconds={fiveMinCountdown.remainingSeconds}
          activityLabel={fiveMinCountdown.activityLabel}
        />
      )}

      {/* Activity Picker */}
      {isSessionActive && (
        <SimpleActivityPicker
          currentActivity={session?.current_activity || null}
          onActivityChange={switchActivity}
          disabled={isSwitching}
          isOnBreak={breakStatus.onBreak}
          breakLabel={breakStatus.breakLabel}
          isLoading={isSwitching}
        />
      )}

      {/* Break notice */}
      {!withinWorkHours && (
        <Card className="border-muted">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              ⏰ Outside work hours (10:00 AM - 7:00 PM Dubai time)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AttendanceCard attendance={attendance} />
        <CallingStatsCard stats={callingStats} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Session Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Started</span>
              <span className="font-medium">
                {session?.start_time 
                  ? format(new Date(session.start_time), 'HH:mm')
                  : '--:--'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Confirmation</span>
              <span className="font-medium">
                {session?.last_confirmation_at 
                  ? format(new Date(session.last_confirmation_at), 'HH:mm')
                  : '--:--'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Missed Confirmations</span>
              <Badge variant={session?.missed_confirmations ? "destructive" : "secondary"}>
                {session?.missed_confirmations || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Timeline */}
      <ActivityTimeline logs={todayLogs} />

      {/* My Attendance History */}
      <MyAttendanceHistory />
    </div>
  );
};

export default ActivityMonitorPage;