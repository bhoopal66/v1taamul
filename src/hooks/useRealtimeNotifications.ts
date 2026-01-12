import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RealtimeNotification {
  id: string;
  type: 'call' | 'lead' | 'interested';
  agentName: string;
  companyName: string;
  timestamp: Date;
  isNew: boolean;
}

const MAX_NOTIFICATIONS = 50;

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());

  // Fetch all profiles for agent names (using profiles_public for non-sensitive data)
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles_public')
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

  const addNotification = useCallback((notification: Omit<RealtimeNotification, 'id' | 'isNew'>) => {
    const newNotification: RealtimeNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isNew: true,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      // Mark as not new after 3 seconds
      setTimeout(() => {
        setNotifications(current => 
          current.map(n => n.id === newNotification.id ? { ...n, isNew: false } : n)
        );
      }, 3000);
      return updated;
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isNew: false })));
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('dashboard-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_feedback',
        },
        async (payload) => {
          const data = payload.new as any;
          const agentName = profiles.get(data.agent_id) || 'Agent';
          
          // Fetch contact info
          const { data: contact } = await supabase
            .from('master_contacts')
            .select('company_name')
            .eq('id', data.contact_id)
            .single();

          addNotification({
            type: data.feedback_status === 'interested' ? 'interested' : 'call',
            agentName,
            companyName: contact?.company_name || 'Unknown Company',
            timestamp: new Date(data.call_timestamp || new Date()),
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
        },
        async (payload) => {
          const data = payload.new as any;
          const agentName = profiles.get(data.agent_id) || 'Agent';
          
          // Fetch contact info
          const { data: contact } = await supabase
            .from('master_contacts')
            .select('company_name')
            .eq('id', data.contact_id)
            .single();

          addNotification({
            type: 'lead',
            agentName,
            companyName: contact?.company_name || 'Unknown Company',
            timestamp: new Date(data.created_at || new Date()),
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profiles, addNotification]);

  const unreadCount = notifications.filter(n => n.isNew).length;

  return {
    notifications,
    isConnected,
    unreadCount,
    clearNotifications,
    markAllAsRead,
  };
};
