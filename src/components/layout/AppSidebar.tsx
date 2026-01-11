import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Phone,
  Upload,
  Users,
  BarChart3,
  MessageSquare,
  Settings,
  LogOut,
  Target,
  UserCircle,
  Headphones,
  Trophy,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CompactLevelBadge } from '@/components/profile/CompactLevelBadge';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { LoginStreakBadge } from '@/components/profile/LoginStreakBadge';
import { useLoginStreak } from '@/hooks/useLoginStreak';

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
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary font-medium'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
};

export const AppSidebar: React.FC = () => {
  const { profile, userRole } = useAuth();
  const navigate = useNavigate();
  const { streakData } = useLoginStreak();

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Headphones className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sidebar-foreground">TeleSales</h1>
            <p className="text-xs text-sidebar-muted">Automation System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavItem to="/dashboard" icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
        <NavItem to="/profile" icon={<UserCircle className="w-5 h-5" />} label="My Profile" />
        <NavItem to="/leaderboard" icon={<Trophy className="w-5 h-5" />} label="Leaderboard" />
        <NavItem to="/call-list" icon={<Phone className="w-5 h-5" />} label="Call List" />
        <NavItem to="/upload" icon={<Upload className="w-5 h-5" />} label="Upload Contacts" />
        <NavItem to="/leads" icon={<Target className="w-5 h-5" />} label="Leads" />
        
        
        {(userRole === 'supervisor' || userRole === 'operations_head' || userRole === 'admin' || userRole === 'super_admin') && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-sidebar-muted uppercase tracking-wider">
                Management
              </p>
            </div>
            <NavItem to="/supervisor" icon={<BarChart3 className="w-5 h-5" />} label="Overall View" />
            <NavItem to="/team" icon={<Users className="w-5 h-5" />} label="Agent Management" />
            <NavItem to="/reports" icon={<BarChart3 className="w-5 h-5" />} label="Reports" />
          </>
        )}

        {(userRole === 'admin' || userRole === 'super_admin') && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-sidebar-muted uppercase tracking-wider">
                Administration
              </p>
            </div>
            <NavItem to="/user-management" icon={<Shield className="w-5 h-5" />} label="User Management" />
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
