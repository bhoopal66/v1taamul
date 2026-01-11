import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell, BellOff, BellRing, Phone, Star, UserCheck, Trash2, CheckCheck, WifiOff, Settings } from 'lucide-react';
import { useRealtimeNotifications, RealtimeNotification } from '@/hooks/useRealtimeNotifications';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export const RealtimeNotificationsPanel = () => {
  const { notifications, isConnected, unreadCount, clearNotifications, markAllAsRead } = useRealtimeNotifications();
  const { 
    enabled: browserNotificationsEnabled, 
    settings: notificationSettings, 
    isSupported, 
    toggleNotifications, 
    updateSettings,
    permission 
  } = useBrowserNotifications();
  const [isExpanded, setIsExpanded] = useState(true);

  const getIcon = (type: RealtimeNotification['type']) => {
    switch (type) {
      case 'interested':
        return <Star className="w-4 h-4 text-yellow-500" />;
      case 'lead':
        return <UserCheck className="w-4 h-4 text-green-500" />;
      default:
        return <Phone className="w-4 h-4 text-primary" />;
    }
  };

  const getTypeLabel = (type: RealtimeNotification['type']) => {
    switch (type) {
      case 'interested':
        return 'Interested Call';
      case 'lead':
        return 'New Lead';
      default:
        return 'Call Made';
    }
  };

  const getTypeBgColor = (type: RealtimeNotification['type']) => {
    switch (type) {
      case 'interested':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'lead':
        return 'bg-green-500/10 border-green-500/30';
      default:
        return 'bg-primary/10 border-primary/30';
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-primary" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <CardTitle className="text-base font-medium">Live Activity</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                {isConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-muted-foreground" />
                    <span>Connecting...</span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={clearNotifications}
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {/* Browser Notifications Settings */}
            {isSupported && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-8 w-8", browserNotificationsEnabled && "text-primary")}
                    title="Desktop notification settings"
                  >
                    <BellRing className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Desktop Notifications</h4>
                      <p className="text-xs text-muted-foreground">
                        Get notified when the dashboard is in the background
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="browser-notif" className="text-sm">
                        Enable notifications
                      </Label>
                      <Switch 
                        id="browser-notif"
                        checked={browserNotificationsEnabled}
                        onCheckedChange={toggleNotifications}
                      />
                    </div>

                    {permission === 'denied' && (
                      <p className="text-xs text-destructive">
                        Notifications blocked. Please enable in browser settings.
                      </p>
                    )}

                    {browserNotificationsEnabled && (
                      <div className="space-y-3 pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Notify me about:</p>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="notif-calls" className="text-sm flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            New calls
                          </Label>
                          <Switch 
                            id="notif-calls"
                            checked={notificationSettings.calls}
                            onCheckedChange={(checked) => updateSettings({ calls: checked })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="notif-interested" className="text-sm flex items-center gap-2">
                            <Star className="w-3 h-3 text-yellow-500" />
                            Interested leads
                          </Label>
                          <Switch 
                            id="notif-interested"
                            checked={notificationSettings.interested}
                            onCheckedChange={(checked) => updateSettings({ interested: checked })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="notif-leads" className="text-sm flex items-center gap-2">
                            <UserCheck className="w-3 h-3 text-green-500" />
                            New leads generated
                          </Label>
                          <Switch 
                            id="notif-leads"
                            checked={notificationSettings.leads}
                            onCheckedChange={(checked) => updateSettings({ leads: checked })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <ScrollArea className="h-[300px] pr-3">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                <Bell className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No activity yet</p>
                <p className="text-xs">New calls and leads will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all duration-300",
                      getTypeBgColor(notification.type),
                      notification.isNew && "ring-2 ring-primary/50 animate-pulse"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {getTypeLabel(notification.type)}
                          </Badge>
                          {notification.isNew && (
                            <Badge className="text-xs px-1.5 py-0 bg-primary">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">
                          {notification.agentName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {notification.companyName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {notifications.length > 0 && (
            <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</span>
              <span>{unreadCount} unread</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
