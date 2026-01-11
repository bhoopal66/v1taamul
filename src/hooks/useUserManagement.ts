import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  username: string;
  is_active: boolean | null;
  created_at: string | null;
  last_login: string | null;
  roles: AppRole[];
}

export interface UserExportData {
  user: UserWithRole;
  contacts: any[];
  callFeedback: any[];
  leads: any[];
  uploads: any[];
}

export const useUserManagement = () => {
  const queryClient = useQueryClient();

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // First get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Then get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        username: profile.username,
        is_active: profile.is_active,
        created_at: profile.created_at,
        last_login: profile.last_login,
        roles: roles
          ?.filter(r => r.user_id === profile.id)
          .map(r => r.role) || [],
      }));

      return usersWithRoles;
    },
  });

  // Add role to user
  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role added successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error(`Failed to add role: ${error.message}`);
    },
  });

  // Remove role from user
  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role removed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error(`Failed to remove role: ${error.message}`);
    },
  });

  // Toggle user active status
  const toggleUserActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`User ${variables.isActive ? 'activated' : 'deactivated'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error(`Failed to update user status: ${error.message}`);
    },
  });

  // Export user data before removal
  const exportUserData = async (userId: string): Promise<UserExportData | null> => {
    const user = users?.find(u => u.id === userId);
    if (!user) return null;

    // Fetch all user's data
    const [contactsRes, feedbackRes, leadsRes, uploadsRes] = await Promise.all([
      supabase.from('master_contacts').select('*').eq('first_uploaded_by', userId),
      supabase.from('call_feedback').select('*').eq('agent_id', userId),
      supabase.from('leads').select('*').eq('agent_id', userId),
      supabase.from('call_sheet_uploads').select('*').eq('agent_id', userId),
    ]);

    return {
      user,
      contacts: contactsRes.data || [],
      callFeedback: feedbackRes.data || [],
      leads: leadsRes.data || [],
      uploads: uploadsRes.data || [],
    };
  };

  // Move user data to company pool before removal
  const moveUserDataToPool = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('master_contacts')
        .update({ 
          in_company_pool: true, 
          pool_entry_date: new Date().toISOString(),
          current_owner_agent_id: null 
        } as any)
        .eq('first_uploaded_by', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User data moved to company pool');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error(`Failed to move data: ${error.message}`);
    },
  });

  // Deactivate user (soft delete - keeps data)
  const deactivateUser = useMutation({
    mutationFn: async (userId: string) => {
      // First move their contacts to pool
      await supabase
        .from('master_contacts')
        .update({ 
          in_company_pool: true, 
          pool_entry_date: new Date().toISOString(),
          current_owner_agent_id: null 
        } as any)
        .eq('first_uploaded_by', userId);

      // Then deactivate the profile
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User deactivated and data moved to company pool');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      toast.error(`Failed to deactivate user: ${error.message}`);
    },
  });

  return {
    users: users || [],
    isLoading,
    addRole: addRole.mutate,
    removeRole: removeRole.mutate,
    toggleUserActive: toggleUserActive.mutate,
    exportUserData,
    moveUserDataToPool: moveUserDataToPool.mutate,
    deactivateUser: deactivateUser.mutate,
    isUpdating: addRole.isPending || removeRole.isPending || toggleUserActive.isPending || moveUserDataToPool.isPending || deactivateUser.isPending,
  };
};

export const useCompanyPool = () => {
  const queryClient = useQueryClient();

  // Fetch contacts in company pool
  const { data: poolContacts, isLoading } = useQuery({
    queryKey: ['company-pool'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_contacts')
        .select('*')
        .eq('in_company_pool', true)
        .order('pool_entry_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Trigger moving old contacts to pool
  const moveOldContactsToPool = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('move_old_contacts_to_pool');
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      toast.success(`Moved ${count} contacts to company pool`);
      queryClient.invalidateQueries({ queryKey: ['company-pool'] });
    },
    onError: (error) => {
      toast.error(`Failed to move contacts: ${error.message}`);
    },
  });

  return {
    poolContacts: poolContacts || [],
    isLoading,
    moveOldContactsToPool: moveOldContactsToPool.mutate,
    isMoving: moveOldContactsToPool.isPending,
  };
};
