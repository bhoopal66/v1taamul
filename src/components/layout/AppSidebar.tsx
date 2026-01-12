import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { signOut } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  LayoutDashboard,
  Phone,
  Upload,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Target,
  UserCircle,
  Headphones,
  Trophy,
  Shield,
  Bell,
  TrendingDown,
  ChevronRight,
  History,
} from 'lucide-react';
import { canAccessPage, canUseFeature } from '@/config/rolePermissions';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompactLevelBadge } from '@/components/profile/CompactLevelBadge';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { LoginStreakBadge } from '@/components/profile/LoginStreakBadge';
import { useLoginStreak } from '@/hooks/useLoginStreak';
import { usePerformanceAlerts } from '@/hooks/usePerformanceAlerts';

const METRIC_LABELS: Record<string, string> = {
  total_calls: 'Total Calls',
  interested_count: 'Interested',
  leads_generated: 'Leads Generated',
  conversion_rate: 'Conversion Rate',
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-semibold',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary font-bold'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground font-medium'
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

export const AppSidebar: React.FC = () => {
  const { profile, userRole, ledTeamId } = useAuth();
  const navigate = useNavigate();
  const { streakData } = useLoginStreak();
  const { alerts, activeAlertsCount, acknowledgeAlert } = usePerformanceAlerts();
  
  const isTeamLeader = !!ledTeamId;
  const role = userRole as AppRole;
  
  // Helper function to check page access
  const hasPageAccess = (path: string) => canAccessPage(role, path, isTeamLeader);
  
  // Helper function to check feature access
  const hasFeatureAccess = (feature: string) => canUseFeature(role, feature);
  
  // Section visibility
  const showManagementSection = hasPageAccess('/supervisor') || hasPageAccess('/reports') || (hasPageAccess('/my-team') && ['supervisor', 'operations_head', 'admin', 'super_admin'].includes(userRole || ''));
  const showAdminSection = hasPageAccess('/team-management') || hasPageAccess('/user-management');
  const showTeamLeaderSection = isTeamLeader && userRole === 'agent';

  // Fetch user's team name
  const { data: userTeam } = useQuery({
    queryKey: ['user-team', profile?.team_id],
    queryFn: async () => {
      if (!profile?.team_id) return null;
      const { data, error } = await supabase
        .from('teams')
        .select('name')
        .eq('id', profile.team_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.team_id,
  });

  // Get recent active alerts (max 5)
  const recentAlerts = alerts
    .filter(a => a.alert_status === 'active')
    .slice(0, 5);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      navigate('/login');
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string | null) => {
    if (!role) return 'Agent';
    return role
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <aside className="w-64 h-screen bg-sidebar flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <Headphones className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-sidebar-foreground">TeleSales</h1>
              <p className="text-xs text-sidebar-muted font-medium">Automation System</p>
            </div>
          </div>
          
          {/* Notification Bell with Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              >
                <Bell className="w-5 h-5" />
                {activeAlertsCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center"
                  >
                    {activeAlertsCount > 99 ? '99+' : activeAlertsCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 p-0 bg-popover border-border shadow-lg" 
              align="start"
              sideOffset={8}
            >
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Performance Alerts</h4>
                  {activeAlertsCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {activeAlertsCount} active
                    </Badge>
                  )}
                </div>
              </div>
              
              {recentAlerts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active alerts</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="divide-y divide-border">
                    {recentAlerts.map((alert) => {
                      const isCritical = alert.severity === 'critical';
                      return (
                        <div 
                          key={alert.id} 
                          className={`p-3 hover:bg-muted/50 transition-colors ${isCritical ? 'bg-destructive/5' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 p-1.5 rounded-full ${isCritical ? 'bg-destructive/10' : 'bg-amber-500/10'}`}>
                              <TrendingDown className={`w-3.5 h-3.5 ${isCritical ? 'text-destructive' : 'text-amber-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">
                                  {METRIC_LABELS[alert.metric] || alert.metric}
                                </span>
                                <Badge 
                                  variant={isCritical ? 'destructive' : 'secondary'}
                                  className={`text-xs ${!isCritical ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                                >
                                  {isCritical ? 'Critical' : 'Warning'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {alert.alert_type === 'team' ? alert.team_name : alert.agent_name} • {alert.actual_value} / {alert.target_value} ({alert.percentage_achieved.toFixed(0)}%)
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                acknowledgeAlert.mutate(alert.id);
                              }}
                            >
                              Ack
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
              
              <div className="p-2 border-t border-border space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/team-management?tab=alerts')}
                >
                  View active alerts
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/alert-history')}
                >
                  Alert history
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {hasPageAccess('/dashboard') && (
          <NavItem to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
        )}
        <NavItem to="/profile" icon={<UserCircle className="w-5 h-5" />} label="My Profile" />
        <NavItem to="/leaderboard" icon={<Trophy className="w-5 h-5" />} label="Leaderboard" />
        <NavItem to="/call-list" icon={<Phone className="w-5 h-5" />} label="Call List" />
        <NavItem to="/upload" icon={<Upload className="w-5 h-5" />} label="Upload Contacts" />
        <NavItem to="/leads" icon={<Target className="w-5 h-5" />} label="Leads" />
        
        {/* Team Leader Section - Show only for team leaders who are not supervisors */}
        {showTeamLeaderSection && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-bold text-sidebar-muted uppercase tracking-wider">
                My Team
              </p>
            </div>
            <NavItem to="/my-team" icon={<Users className="w-5 h-5" />} label="Team Dashboard" />
          </>
        )}
        
        {/* Management Section */}
        {showManagementSection && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-bold text-sidebar-muted uppercase tracking-wider">
                Management
              </p>
            </div>
            {isTeamLeader && ['supervisor', 'operations_head', 'admin', 'super_admin'].includes(userRole || '') && (
              <NavItem to="/my-team" icon={<Users className="w-5 h-5" />} label="My Team" />
            )}
            {hasPageAccess('/supervisor') && (
              <NavItem to="/supervisor" icon={<BarChart3 className="w-5 h-5" />} label="Team Overview" />
            )}
            {hasPageAccess('/reports') && (
              <NavItem to="/reports" icon={<BarChart3 className="w-5 h-5" />} label="Reports" />
            )}
            {hasPageAccess('/alert-history') && (
              <NavItem to="/alert-history" icon={<History className="w-5 h-5" />} label="Alert History" />
            )}
          </>
        )}

        {/* Administration Section */}
        {showAdminSection && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-bold text-sidebar-muted uppercase tracking-wider">
                Administration
              </p>
            </div>
            {hasPageAccess('/team-management') && (
              <NavItem to="/team-management" icon={<Users className="w-5 h-5" />} label="Team Management" />
            )}
            {hasPageAccess('/user-management') && (
              <NavItem to="/user-management" icon={<Shield className="w-5 h-5" />} label="User Management" />
            )}
            {hasPageAccess('/permissions') && (
              <NavItem to="/permissions" icon={<Shield className="w-5 h-5" />} label="Permissions" />
            )}
          </>
        )}

      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {/* Level Badge */}
        <CompactLevelBadge />
        
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || profile?.username || 'User'}
              </p>
              {streakData && streakData.currentStreak > 0 && (
                <LoginStreakBadge
                  currentStreak={streakData.currentStreak}
                  longestStreak={streakData.longestStreak}
                  variant="compact"
                />
              )}
            </div>
            <p className="text-xs text-sidebar-muted truncate">
              {getRoleLabel(userRole)}
              {userTeam?.name && <span> • {userTeam.name}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <SoundToggle 
            variant="compact" 
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50" 
          />
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={() => navigate('/settings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
