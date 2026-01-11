import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { Settings, Bell, Volume2, User, Shield } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { profile, userRole } = useAuth();
  const { soundEnabled, toggleSound } = useSoundSettings();

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
                <Label>Desktop Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive browser notifications
                </p>
              </div>
              <Switch disabled />
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
                <Label>Daily Goal Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get reminded about your daily targets
                </p>
              </div>
              <Switch disabled />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Streak Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Don't lose your login streak
                </p>
              </div>
              <Switch disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
