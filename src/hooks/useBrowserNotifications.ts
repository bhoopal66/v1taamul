import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const NOTIFICATION_PERMISSION_KEY = 'browser_notifications_enabled';

const METRIC_LABELS: Record<string, string> = {
  total_calls: 'Total Calls',
  interested_count: 'Interested',
  leads_generated: 'Leads Generated',
  conversion_rate: 'Conversion Rate',
};

interface PerformanceAlertPayload {
  id: string;
  alert_type: 'team' | 'agent';
  metric: string;
  target_value: number;
  actual_value: number;
  percentage_achieved: number;
  team_id: string | null;
  agent_id: string | null;
  alert_status: string;
  severity: 'warning' | 'critical';
  message: string | null;
  created_at: string;
}

export const useBrowserNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
    return stored === 'true';
  });

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications are not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setEnabled(true);
        localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
        toast.success('Browser notifications enabled');
        return true;
      } else if (result === 'denied') {
        toast.error('Notification permission denied');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, []);

  // Toggle notifications
  const toggleNotifications = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'false');
      toast.success('Browser notifications disabled');
    } else {
      if (permission === 'granted') {
        setEnabled(true);
        localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
        toast.success('Browser notifications enabled');
      } else {
        await requestPermission();
      }
    }
  }, [enabled, permission, requestPermission]);

  // Show a browser notification
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!enabled || permission !== 'granted') return;

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [enabled, permission]);

  // Subscribe to realtime performance alerts
  useEffect(() => {
    if (!user?.id || !enabled || permission !== 'granted') return;

    const channel = supabase
      .channel('performance-alerts-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'performance_alerts',
        },
        (payload) => {
          const alert = payload.new as PerformanceAlertPayload;
          
          // Only show notification for active alerts
          if (alert.alert_status !== 'active') return;

          const metricLabel = METRIC_LABELS[alert.metric] || alert.metric;
          const entityType = alert.alert_type === 'team' ? 'Team' : 'Agent';
          const severityIcon = alert.severity === 'critical' ? '🚨' : '⚠️';
          const severityLabel = alert.severity === 'critical' ? 'CRITICAL' : 'Warning';
          
          showNotification(
            `${severityIcon} ${severityLabel}: Performance Alert`,
            {
              body: `${entityType} ${metricLabel} is at ${alert.percentage_achieved.toFixed(0)}% of target (${alert.actual_value}/${alert.target_value})`,
              tag: `alert-${alert.id}`,
              requireInteraction: alert.severity === 'critical',
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, enabled, permission, showNotification]);

  return {
    permission,
    enabled,
    isSupported: 'Notification' in window,
    requestPermission,
    toggleNotifications,
    showNotification,
  };
};
