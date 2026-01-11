import React, { useState } from 'react';
import { usePerformanceAlerts, PerformanceAlert } from '@/hooks/usePerformanceAlerts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, Clock, Users, User, Bell, BellOff, RefreshCw, AlertOctagon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const METRIC_LABELS: Record<string, string> = {
  calls: 'Calls',
  leads: 'Leads',
  conversion_rate: 'Conversion Rate',
};

const getSeverityConfig = (severity: 'warning' | 'critical') => {
  if (severity === 'critical') {
    return {
      icon: <AlertOctagon className="w-4 h-4 text-destructive" />,
      badgeVariant: 'destructive' as const,
      bgClass: 'bg-destructive/5 border-destructive/30',
      label: 'Critical',
    };
  }
  return {
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    badgeVariant: 'secondary' as const,
    bgClass: 'bg-amber-500/5 border-amber-500/30',
    label: 'Warning',
  };
};

export const PerformanceAlertsList: React.FC = () => {
  const { alerts, isLoading, acknowledgeAlert, resolveAlert, refetchAlerts } = usePerformanceAlerts();
  const [isChecking, setIsChecking] = useState(false);

  const runPerformanceCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-performance-alerts');
      
      if (error) throw error;
      
      toast.success(`Check complete: ${data.alerts_created} new alerts, ${data.alerts_resolved} resolved`);
      refetchAlerts();
    } catch (error: any) {
      toast.error('Failed to run performance check: ' + error.message);
    } finally {
      setIsChecking(false);
    }
  };

  const activeAlerts = alerts.filter(a => a.alert_status === 'active');
  const acknowledgedAlerts = alerts.filter(a => a.alert_status === 'acknowledged');
  const resolvedAlerts = alerts.filter(a => a.alert_status === 'resolved').slice(0, 10);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'acknowledged':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string): 'destructive' | 'secondary' | 'outline' => {
    switch (status) {
      case 'active':
        return 'destructive';
      case 'acknowledged':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const AlertCard: React.FC<{ alert: PerformanceAlert }> = ({ alert }) => {
    const metricLabel = METRIC_LABELS[alert.metric] || alert.metric;
    const isPercentage = alert.metric === 'conversion_rate';
    const severityConfig = getSeverityConfig(alert.severity || 'warning');

    return (
      <div className={`p-4 border rounded-lg space-y-3 hover:bg-muted/50 transition-colors ${alert.alert_status === 'active' ? severityConfig.bgClass : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {alert.alert_status === 'active' ? severityConfig.icon : getStatusIcon(alert.alert_status)}
            <Badge variant={alert.alert_type === 'team' ? 'default' : 'secondary'}>
              {alert.alert_type === 'team' ? (
                <><Users className="w-3 h-3 mr-1" /> {alert.team_name}</>
              ) : (
                <><User className="w-3 h-3 mr-1" /> {alert.agent_name}</>
              )}
            </Badge>
            {alert.alert_status === 'active' && (
              <Badge 
                variant={severityConfig.badgeVariant}
                className={alert.severity === 'critical' ? '' : 'bg-amber-500 hover:bg-amber-600 text-white'}
              >
                {severityConfig.label}
              </Badge>
            )}
          </div>
          <Badge variant={getStatusBadgeVariant(alert.alert_status)}>
            {alert.alert_status}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">
            {metricLabel} below target
          </p>
          <p className="text-sm text-muted-foreground">
            Achieved {alert.actual_value}{isPercentage ? '%' : ''} of {alert.target_value}{isPercentage ? '%' : ''} target 
            ({alert.percentage_achieved.toFixed(1)}%)
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span title={format(new Date(alert.created_at), 'PPpp')}>
            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
          </span>
          
          <div className="flex gap-2">
            {alert.alert_status === 'active' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => acknowledgeAlert.mutate(alert.id)}
                disabled={acknowledgeAlert.isPending}
              >
                Acknowledge
              </Button>
            )}
            {alert.alert_status === 'acknowledged' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => resolveAlert.mutate(alert.id)}
                disabled={resolveAlert.isPending}
              >
                Resolve
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      <Card className={activeAlerts.length > 0 ? 'border-destructive/50' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Active Alerts
                {activeAlerts.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {activeAlerts.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Alerts requiring immediate attention</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={runPerformanceCheck}
              disabled={isChecking}
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : 'Check Now'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeAlerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <BellOff className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No active alerts</p>
              <p className="text-sm">All teams and agents are performing within targets.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-3">
                {activeAlerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Acknowledged Alerts */}
      {acknowledgedAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Acknowledged
              <Badge variant="secondary" className="ml-2">
                {acknowledgedAlerts.length}
              </Badge>
            </CardTitle>
            <CardDescription>Alerts being addressed</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-60">
              <div className="space-y-3">
                {acknowledgedAlerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recently Resolved */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Recently Resolved
            </CardTitle>
            <CardDescription>Last 10 resolved alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-40">
              <div className="space-y-2">
                {resolvedAlerts.map(alert => (
                  <div key={alert.id} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {alert.alert_type === 'team' ? alert.team_name : alert.agent_name}
                      </Badge>
                      <span className="text-muted-foreground">
                        {METRIC_LABELS[alert.metric] || alert.metric}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
