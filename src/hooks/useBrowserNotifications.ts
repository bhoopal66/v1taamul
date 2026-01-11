import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const NOTIFICATION_PERMISSION_KEY = 'browser_notifications_enabled';
const NOTIFICATION_CALLS_KEY = 'browser_notifications_calls';
const NOTIFICATION_LEADS_KEY = 'browser_notifications_leads';
const NOTIFICATION_INTERESTED_KEY = 'browser_notifications_interested';

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

export interface NotificationSettings {
  calls: boolean;
  leads: boolean;
  interested: boolean;
}

export const useBrowserNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
    return stored === 'true';
  });
  const [settings, setSettings] = useState<NotificationSettings>(() => ({
    calls: localStorage.getItem(NOTIFICATION_CALLS_KEY) !== 'false',
    leads: localStorage.getItem(NOTIFICATION_LEADS_KEY) !== 'false',
    interested: localStorage.getItem(NOTIFICATION_INTERESTED_KEY) !== 'false',
  }));
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());

  // Fetch profiles for agent names
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username');
      
      if (data) {
        const map = new Map<string, string>();
        data.forEach(p => {
          map.set(p.id, p.full_name || p.username || 'Unknown Agent');
        });
        setProfiles(map);
      }
    };

    if (user?.id) {
      fetchProfiles();
    }
  }, [user?.id]);

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

  // Update notification settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.calls !== undefined) {
        localStorage.setItem(NOTIFICATION_CALLS_KEY, String(updated.calls));
      }
      if (newSettings.leads !== undefined) {
        localStorage.setItem(NOTIFICATION_LEADS_KEY, String(updated.leads));
      }
      if (newSettings.interested !== undefined) {
        localStorage.setItem(NOTIFICATION_INTERESTED_KEY, String(updated.interested));
      }
      return updated;
    });
  }, []);

  // Show a browser notification
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!enabled || permission !== 'granted') return;

    // Check if document is hidden (tab in background)
    if (!document.hidden) return;

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

  // Subscribe to call_feedback for call and interested notifications
  useEffect(() => {
    if (!user?.id || !enabled || permission !== 'granted') return;
    if (!settings.calls && !settings.interested) return;

    const channel = supabase
      .channel('calls-browser-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_feedback',
        },
        async (payload) => {
          const data = payload.new as any;
          const agentName = profiles.get(data.agent_id) || 'An agent';
          
          // Fetch contact info
          const { data: contact } = await supabase
            .from('master_contacts')
            .select('company_name')
            .eq('id', data.contact_id)
            .single();

          const companyName = contact?.company_name || 'a company';

          if (data.feedback_status === 'interested' && settings.interested) {
            showNotification('⭐ Interested Lead!', {
              body: `${agentName} marked ${companyName} as interested`,
              tag: `interested-${data.id}`,
            });
          } else if (settings.calls && data.feedback_status !== 'interested') {
            showNotification('📞 New Call', {
              body: `${agentName} completed a call with ${companyName}`,
              tag: `call-${data.id}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, enabled, permission, settings.calls, settings.interested, profiles, showNotification]);

  // Subscribe to leads for new lead notifications
  useEffect(() => {
    if (!user?.id || !enabled || permission !== 'granted' || !settings.leads) return;

    const channel = supabase
      .channel('leads-browser-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
        },
        async (payload) => {
          const data = payload.new as any;
          const agentName = profiles.get(data.agent_id) || 'An agent';
          
          // Fetch contact info
          const { data: contact } = await supabase
            .from('master_contacts')
            .select('company_name')
            .eq('id', data.contact_id)
            .single();

          const companyName = contact?.company_name || 'a company';

          showNotification('🎯 New Lead Generated!', {
            body: `${agentName} generated a lead from ${companyName}`,
            tag: `lead-${data.id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, enabled, permission, settings.leads, profiles, showNotification]);

  return {
    permission,
    enabled,
    settings,
    isSupported: 'Notification' in window,
    requestPermission,
    toggleNotifications,
    updateSettings,
    showNotification,
  };
};
