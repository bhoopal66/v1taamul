import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface PagePermission {
  path: string;
  allowedRoles: AppRole[];
  redirectTo?: string; // Where to redirect unauthorized users
  label: string;
}

export interface FeaturePermission {
  feature: string;
  allowedRoles: AppRole[];
}

// Define all page permissions
export const PAGE_PERMISSIONS: PagePermission[] = [
  // Agent-accessible pages (everyone can access)
  { path: '/profile', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'My Profile' },
  { path: '/leaderboard', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'Leaderboard' },
  { path: '/call-list', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'Call List' },
  { path: '/upload', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'Upload Contacts' },
  { path: '/leads', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'Leads' },
  { path: '/activity-monitor', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'Activity Monitor' },
  { path: '/settings', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'Settings' },
  
  // Management pages (supervisor and above)
  { path: '/dashboard', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'], redirectTo: '/profile', label: 'Dashboard' },
  { path: '/supervisor', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'], redirectTo: '/profile', label: 'Team Overview' },
  { path: '/reports', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'], redirectTo: '/profile', label: 'Reports' },
  
  // Team leader pages (requires ledTeamId)
  { path: '/my-team', allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller', 'coordinator'], label: 'My Team' },
  
  // Admin pages
  { path: '/team-management', allowedRoles: ['admin', 'super_admin'], redirectTo: '/profile', label: 'Team Management' },
  { path: '/user-management', allowedRoles: ['supervisor', 'admin', 'super_admin'], redirectTo: '/profile', label: 'User Management' },
  { path: '/alert-history', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'], redirectTo: '/profile', label: 'Alert History' },
];

// Define feature-level permissions
export const FEATURE_PERMISSIONS: FeaturePermission[] = [
  { feature: 'view_all_agents_data', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'] },
  { feature: 'manage_users', allowedRoles: ['admin', 'super_admin'] },
  { feature: 'manage_teams', allowedRoles: ['admin', 'super_admin'] },
  { feature: 'approve_uploads', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'] },
  { feature: 'view_reports', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'] },
  { feature: 'manage_performance_targets', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'] },
  { feature: 'acknowledge_alerts', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'] },
  { feature: 'export_data', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'] },
  { feature: 'view_stage_duration_widget', allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'] },
];

// Helper function to check if a role has access to a page
export function canAccessPage(role: AppRole | null, path: string): boolean {
  if (!role) return false;
  const permission = PAGE_PERMISSIONS.find(p => p.path === path);
  if (!permission) return true; // If no permission defined, allow access
  return permission.allowedRoles.includes(role);
}

// Helper function to get redirect path for unauthorized access
export function getRedirectPath(path: string): string {
  const permission = PAGE_PERMISSIONS.find(p => p.path === path);
  return permission?.redirectTo || '/profile';
}

// Helper function to check if a role has access to a feature
export function canAccessFeature(role: AppRole | null, feature: string): boolean {
  if (!role) return false;
  const permission = FEATURE_PERMISSIONS.find(p => p.feature === feature);
  if (!permission) return true; // If no permission defined, allow access
  return permission.allowedRoles.includes(role);
}

// Role hierarchy for display purposes
export const ROLE_HIERARCHY: Record<AppRole, number> = {
  agent: 1,
  coordinator: 2,
  sales_controller: 3,
  supervisor: 4,
  operations_head: 5,
  admin: 6,
  super_admin: 7,
};

// Get user-friendly role label
export function getRoleLabel(role: AppRole | string | null): string {
  if (!role) return 'Agent';
  const labels: Record<string, string> = {
    agent: 'Agent',
    coordinator: 'Coordinator',
    sales_controller: 'Sales Controller',
    supervisor: 'Supervisor',
    operations_head: 'Operations Head',
    admin: 'Admin',
    super_admin: 'Super Admin',
  };
  return labels[role] || role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
