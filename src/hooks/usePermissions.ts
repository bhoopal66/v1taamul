import { useAuth } from '@/contexts/AuthContext';
import { 
  canAccessPage, 
  canAccessFeature, 
  getRedirectPath,
  getRoleLabel,
  ROLE_HIERARCHY,
  PAGE_PERMISSIONS,
  FEATURE_PERMISSIONS
} from '@/config/permissions';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export function usePermissions() {
  const { userRole, ledTeamId } = useAuth();

  const role = userRole as AppRole | null;
  const isTeamLeader = !!ledTeamId;

  // Check page access
  const hasPageAccess = (path: string): boolean => {
    // Special case for /my-team - requires being a team leader
    if (path === '/my-team' && !isTeamLeader) {
      return false;
    }
    return canAccessPage(role, path);
  };

  // Check feature access
  const hasFeatureAccess = (feature: string): boolean => {
    return canAccessFeature(role, feature);
  };

  // Get redirect path for unauthorized access
  const getUnauthorizedRedirect = (path: string): string => {
    return getRedirectPath(path);
  };

  // Role checks
  const isAgent = role === 'agent';
  const isSupervisor = role === 'supervisor';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isManagement = ['supervisor', 'operations_head', 'admin', 'super_admin'].includes(role || '');
  const canManageUsers = hasFeatureAccess('manage_users');
  const canManageTeams = hasFeatureAccess('manage_teams');
  const canApproveUploads = hasFeatureAccess('approve_uploads');
  const canViewReports = hasFeatureAccess('view_reports');
  const canViewAllAgentsData = hasFeatureAccess('view_all_agents_data');
  const canExportData = hasFeatureAccess('export_data');
  const canDeleteRecords = hasFeatureAccess('delete_records');
  const canDeleteTeams = hasFeatureAccess('delete_teams');
  const canDeleteUsers = hasFeatureAccess('delete_users');

  // Get role display label
  const roleLabel = getRoleLabel(role);

  // Get role hierarchy level
  const roleLevel = role ? ROLE_HIERARCHY[role] : 0;

  return {
    role,
    roleLabel,
    roleLevel,
    isTeamLeader,
    isAgent,
    isSupervisor,
    isAdmin,
    isManagement,
    hasPageAccess,
    hasFeatureAccess,
    getUnauthorizedRedirect,
    canManageUsers,
    canManageTeams,
    canApproveUploads,
    canViewReports,
    canViewAllAgentsData,
    canExportData,
    canDeleteRecords,
    canDeleteTeams,
    canDeleteUsers,
  };
}
