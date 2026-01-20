import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Trophy,
  Timer
} from 'lucide-react';
import { format } from 'date-fns';
import { AttendanceRecord } from '@/hooks/useActivityMonitor';
import { cn } from '@/lib/utils';

interface AttendanceCardProps {
  attendance: AttendanceRecord | null;
  isLoading?: boolean;
}

const STATUS_CONFIG = {
  present: {
    label: 'Present',
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    badgeVariant: 'default' as const,
  },
  late: {
    label: 'Late',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    badgeVariant: 'secondary' as const,
  },
  absent: {
    label: 'Absent',
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    badgeVariant: 'destructive' as const,
  },
  half_day: {
    label: 'Half Day',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    badgeVariant: 'outline' as const,
  },
};

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  attendance,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = attendance?.status || 'absent';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.absent;
  const StatusIcon = config.icon;

  // Calculate work progress (6 hours = 360 minutes = 100%)
  const workProgress = Math.min(100, ((attendance?.total_work_minutes || 0) / 360) * 100);
  const workHours = Math.floor((attendance?.total_work_minutes || 0) / 60);
  const workMinutes = (attendance?.total_work_minutes || 0) % 60;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Attendance
          </span>
          <Badge variant={config.badgeVariant} className="flex items-center gap-1">
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* First Login */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">First Login</span>
          <span className="font-medium">
            {attendance?.first_login 
              ? format(new Date(attendance.first_login), 'HH:mm') 
              : '--:--'}
          </span>
        </div>

        {/* Late indicator */}
        {attendance?.is_late && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-600 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Late by {attendance.late_by_minutes} minutes</span>
          </div>
        )}

        {/* Work Hours Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Timer className="w-4 h-4" />
              Work Hours
            </span>
            <span className="font-medium">
              {workHours}h {workMinutes}m / 6h
            </span>
          </div>
          <Progress value={workProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {workProgress >= 100 
              ? '✓ Minimum work hours achieved' 
              : `${Math.ceil((360 - (attendance?.total_work_minutes || 0)) / 60)}h remaining for full attendance`}
          </p>
        </div>

        {/* Daily Score */}
        {attendance?.daily_score !== null && attendance?.daily_score !== undefined && (
          <div className={cn(
            "flex items-center justify-between p-3 rounded-lg",
            attendance.daily_score >= 80 ? "bg-green-500/10" : 
            attendance.daily_score >= 60 ? "bg-amber-500/10" : "bg-red-500/10"
          )}>
            <span className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="w-4 h-4" />
              Daily Score
            </span>
            <span className={cn(
              "text-xl font-bold",
              attendance.daily_score >= 80 ? "text-green-600" : 
              attendance.daily_score >= 60 ? "text-amber-600" : "text-red-600"
            )}>
              {Math.round(attendance.daily_score)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
