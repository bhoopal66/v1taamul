import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { Settings, Bell, Volume2, User, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Storage keys for notification preferences
const STORAGE_KEYS = {
  dailyGoalReminders: 'notification_daily_goal_reminders',
  streakReminders: 'notification_streak_reminders',
  performanceAlerts: 'notification_performance_alerts',
  leaderboardUpdates: 'notification_leaderboard_updates',
};

export const SettingsPage: React.FC = () => {
  const { profile, userRole } = useAuth();
  const { soundEnabled, toggleSound } = useSoundSettings();
  const { enabled: notificationsEnabled, permission, isSupported, toggleNotifications } = useBrowserNotifications();
  
  // Notification preference states
  const [dailyGoalReminders, setDailyGoalReminders] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.dailyGoalReminders) !== 'false'
  );
  const [streakReminders, setStreakReminders] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.streakReminders) !== 'false'
  );
  const [performanceAlerts, setPerformanceAlerts] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.performanceAlerts) !== 'false'
  );
  const [leaderboardUpdates, setLeaderboardUpdates] = useState(() => 
    localStorage.getItem(STORAGE_KEYS.leaderboardUpdates) !== 'false'
  );

  // Save preferences to localStorage
  const handleToggle = (key: keyof typeof STORAGE_KEYS, value: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(value);
    localStorage.setItem(STORAGE_KEYS[key], String(value));
    toast.success(value ? 'Notification enabled' : 'Notification disabled');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile?.full_name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={profile?.username || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input 
                value={userRole?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Agent'} 
                disabled 
              />
            </div>
          </CardContent>
        </Card>

        {/* Sound Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Sound & Notifications
            </CardTitle>
            <CardDescription>Configure your audio and notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Celebration Sounds</Label>
                <p className="text-sm text-muted-foreground">
                  Play sounds for achievements and milestones
                </p>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>Desktop Notifications</Label>
                  {!isSupported && (
                    <Badge variant="secondary" className="text-xs">Not Supported</Badge>
                  )}
                  {isSupported && permission === 'denied' && (
                    <Badge variant="destructive" className="text-xs">Blocked</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Receive browser notifications for performance alerts
                </p>
                {permission === 'denied' && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    Enable notifications in your browser settings
                  </p>
                )}
              </div>
              <Switch 
                checked={notificationsEnabled && permission === 'granted'} 
                onCheckedChange={toggleNotifications}
                disabled={!isSupported || permission === 'denied'}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" disabled>
              Change Password
            </Button>
            <p className="text-sm text-muted-foreground">
              Password changes are managed through your account provider.
            </p>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Choose what you want to be notified about</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Performance Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when performance drops below targets
                </p>
              </div>
              <Switch 
                checked={performanceAlerts} 
                onCheckedChange={(v) => handleToggle('performanceAlerts', v, setPerformanceAlerts)} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Daily Goal Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get reminded about your daily targets
                </p>
              </div>
              <Switch 
                checked={dailyGoalReminders} 
                onCheckedChange={(v) => handleToggle('dailyGoalReminders', v, setDailyGoalReminders)} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Streak Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Don't lose your login streak
                </p>
              </div>
              <Switch 
                checked={streakReminders} 
                onCheckedChange={(v) => handleToggle('streakReminders', v, setStreakReminders)} 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Leaderboard Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your rank changes
                </p>
              </div>
              <Switch 
                checked={leaderboardUpdates} 
                onCheckedChange={(v) => handleToggle('leaderboardUpdates', v, setLeaderboardUpdates)} 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
