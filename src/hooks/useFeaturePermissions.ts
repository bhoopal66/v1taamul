import { useAuth } from '@/contexts/AuthContext';
import { canUseFeature, canAccessPage } from '@/config/rolePermissions';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

/**
 * Hook for checking feature-level permissions throughout the app
 * @returns Object with permission check helpers and common permission flags
 */
export function useFeaturePermissions() {
  const { userRole, ledTeamId } = useAuth();
  const role = userRole as AppRole;
  const isTeamLeader = !!ledTeamId;

  // Helper to check any feature
  const hasFeature = (feature: string): boolean => {
    return canUseFeature(role, feature);
  };

  // Helper to check page access
  const hasPageAccess = (path: string): boolean => {
    return canAccessPage(role, path, isTeamLeader);
  };

  // Pre-computed common permissions for easy access
  const permissions = {
    // Export permissions
    canExportCallList: canUseFeature(role, 'export_call_list'),
    canExportContacts: canUseFeature(role, 'export_contacts'),
    canExportLeads: canUseFeature(role, 'export_leads'),

    // User management
    canCreateUser: canUseFeature(role, 'create_user'),
    canDeleteUser: canUseFeature(role, 'delete_user'),
    canChangeUserRole: canUseFeature(role, 'change_user_role'),
    canResetUserPassword: canUseFeature(role, 'reset_user_password'),

    // Team management
    canCreateTeam: canUseFeature(role, 'create_team'),
    canDeleteTeam: canUseFeature(role, 'delete_team'),
    canAssignTeamLeader: canUseFeature(role, 'assign_team_leader'),
    canAssignTeamMembers: canUseFeature(role, 'assign_team_members'),

    // Performance targets
    canCreatePerformanceTarget: canUseFeature(role, 'create_performance_target'),
    canDeletePerformanceTarget: canUseFeature(role, 'delete_performance_target'),

    // Approvals
    canApproveUploads: canUseFeature(role, 'approve_uploads'),
    canApproveSubmissions: canUseFeature(role, 'approve_submissions'),

    // Reports
    canGenerateTeamReport: canUseFeature(role, 'generate_team_report'),
    canScheduleReports: canUseFeature(role, 'schedule_reports'),

    // Data visibility
    canViewAllAgents: canUseFeature(role, 'view_all_agents'),
    canViewAllTeams: canUseFeature(role, 'view_all_teams'),
    canViewStageDuration: canUseFeature(role, 'view_stage_duration'),
  };

  return {
    hasFeature,
    hasPageAccess,
    ...permissions,
    userRole: role,
    isTeamLeader,
  };
}
