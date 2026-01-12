import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface PagePermission {
  path: string;
  label: string;
  allowedRoles: AppRole[];
  section?: 'main' | 'team' | 'management' | 'admin';
  requiresTeamLeader?: boolean; // For team leaders who are not supervisors
}

// Define all pages and their role permissions
export const PAGE_PERMISSIONS: PagePermission[] = [
  // Main navigation - available to most roles
  {
    path: '/dashboard',
    label: 'Dashboard',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'main',
  },
  {
    path: '/profile',
    label: 'My Profile',
    allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'main',
  },
  {
    path: '/leaderboard',
    label: 'Leaderboard',
    allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'main',
  },
  {
    path: '/call-list',
    label: 'Call List',
    allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'main',
  },
  {
    path: '/upload',
    label: 'Upload Contacts',
    allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'main',
  },
  {
    path: '/leads',
    label: 'Leads',
    allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'main',
  },
  
  // Team Leader Section - for team leaders who are NOT supervisors
  {
    path: '/my-team',
    label: 'Team Dashboard',
    allowedRoles: ['agent'], // Agents who are team leaders
    section: 'team',
    requiresTeamLeader: true,
  },
  
  // Management section - supervisors and above
  {
    path: '/my-team',
    label: 'My Team',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    section: 'management',
    requiresTeamLeader: true,
  },
  {
    path: '/supervisor',
    label: 'Team Overview',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    section: 'management',
  },
  {
    path: '/reports',
    label: 'Reports',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    section: 'management',
  },
  
  // Administration section
  {
    path: '/team-management',
    label: 'Team Management',
    allowedRoles: ['admin', 'super_admin'],
    section: 'admin',
  },
  {
    path: '/user-management',
    label: 'User Management',
    allowedRoles: ['admin', 'super_admin', 'supervisor'], // Supervisors who are team leaders
    section: 'admin',
  },
  {
    path: '/alert-history',
    label: 'Alert History',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'admin',
  },
  {
    path: '/permissions',
    label: 'Permissions',
    allowedRoles: ['admin', 'super_admin'],
    section: 'admin',
  },
  
  // Settings - available to all authenticated users
  {
    path: '/settings',
    label: 'Settings',
    allowedRoles: ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    section: 'main',
  },
];

// Feature permissions for specific actions within pages
export interface FeaturePermission {
  feature: string;
  allowedRoles: AppRole[];
  description: string;
}

export const FEATURE_PERMISSIONS: FeaturePermission[] = [
  // Export features
  {
    feature: 'export_call_list',
    allowedRoles: ['super_admin'],
    description: 'Export call list data',
  },
  {
    feature: 'export_contacts',
    allowedRoles: ['admin', 'super_admin'],
    description: 'Export contacts data',
  },
  {
    feature: 'export_leads',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    description: 'Export leads data',
  },
  
  // User management features
  {
    feature: 'create_user',
    allowedRoles: ['admin', 'super_admin'],
    description: 'Create new users',
  },
  {
    feature: 'delete_user',
    allowedRoles: ['super_admin'],
    description: 'Delete users',
  },
  {
    feature: 'change_user_role',
    allowedRoles: ['super_admin'],
    description: 'Change user roles',
  },
  {
    feature: 'reset_user_password',
    allowedRoles: ['admin', 'super_admin'],
    description: 'Reset user passwords',
  },
  
  // Team management features
  {
    feature: 'create_team',
    allowedRoles: ['admin', 'super_admin'],
    description: 'Create new teams',
  },
  {
    feature: 'delete_team',
    allowedRoles: ['super_admin'],
    description: 'Delete teams',
  },
  {
    feature: 'assign_team_leader',
    allowedRoles: ['admin', 'super_admin'],
    description: 'Assign team leaders',
  },
  {
    feature: 'assign_team_members',
    allowedRoles: ['admin', 'super_admin', 'supervisor'],
    description: 'Assign members to teams',
  },
  
  // Performance targets
  {
    feature: 'create_performance_target',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    description: 'Create performance targets',
  },
  {
    feature: 'delete_performance_target',
    allowedRoles: ['admin', 'super_admin'],
    description: 'Delete performance targets',
  },
  
  // Approval features
  {
    feature: 'approve_uploads',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    description: 'Approve contact uploads',
  },
  {
    feature: 'approve_submissions',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    description: 'Approve agent submissions',
  },
  
  // Report features
  {
    feature: 'generate_team_report',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    description: 'Generate team reports',
  },
  {
    feature: 'schedule_reports',
    allowedRoles: ['operations_head', 'admin', 'super_admin'],
    description: 'Schedule automated reports',
  },
  
  // View all data
  {
    feature: 'view_all_agents',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin'],
    description: 'View all agents data',
  },
  {
    feature: 'view_all_teams',
    allowedRoles: ['operations_head', 'admin', 'super_admin'],
    description: 'View all teams data',
  },
  
  // Stage duration widget (Leads page)
  {
    feature: 'view_stage_duration',
    allowedRoles: ['supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'],
    description: 'View lead stage duration analytics',
  },
];

// Helper function to check if a role can access a page
export function canAccessPage(
  userRole: AppRole | null | undefined,
  path: string,
  isTeamLeader: boolean = false
): boolean {
  if (!userRole) return false;
  
  const permission = PAGE_PERMISSIONS.find(p => p.path === path);
  if (!permission) return true; // If not in the list, allow access by default
  
  // Check if role is allowed
  if (!permission.allowedRoles.includes(userRole)) return false;
  
  // Check team leader requirement
  if (permission.requiresTeamLeader && !isTeamLeader) return false;
  
  return true;
}

// Helper function to check if a role can use a feature
export function canUseFeature(
  userRole: AppRole | null | undefined,
  feature: string
): boolean {
  if (!userRole) return false;
  
  const permission = FEATURE_PERMISSIONS.find(f => f.feature === feature);
  if (!permission) return true; // If not in the list, allow by default
  
  return permission.allowedRoles.includes(userRole);
}

// Get all pages accessible by a role
export function getAccessiblePages(
  userRole: AppRole | null | undefined,
  isTeamLeader: boolean = false
): PagePermission[] {
  if (!userRole) return [];
  
  return PAGE_PERMISSIONS.filter(permission => {
    if (!permission.allowedRoles.includes(userRole)) return false;
    if (permission.requiresTeamLeader && !isTeamLeader) return false;
    return true;
  });
}

// Get default redirect path for a role
export function getDefaultRedirectPath(userRole: AppRole | null | undefined): string {
  if (!userRole) return '/login';
  
  // Agents go to profile, others go to dashboard
  if (userRole === 'agent') return '/profile';
  
  return '/dashboard';
}
