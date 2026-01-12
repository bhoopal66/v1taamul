import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type AppRole = 'agent' | 'supervisor' | 'operations_head' | 'admin' | 'super_admin' | 'sales_controller';

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  username: string;
  phone_number: string | null;
  whatsapp_number: string | null;
  team_id: string | null;
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

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      return api.get<UserWithRole[]>('/auth/users');
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      return api.post('/auth/users/role', { userId, role });
    },
    onSuccess: () => {
      toast.success('Role added successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to add role: ${error.message}`);
    },
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      return api.delete('/auth/users/role', { userId, role });
    },
    onSuccess: () => {
      toast.success('Role removed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to remove role: ${error.message}`);
    },
  });

  const toggleUserActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return api.put(`/auth/users/${userId}/active`, { isActive });
    },
    onSuccess: (_, variables) => {
      toast.success(`User ${variables.isActive ? 'activated' : 'deactivated'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update user status: ${error.message}`);
    },
  });

  const exportUserData = async (userId: string): Promise<UserExportData | null> => {
    try {
      return await api.get<UserExportData>(`/auth/users/${userId}/export`);
    } catch {
      return null;
    }
  };

  const moveUserDataToPool = useMutation({
    mutationFn: async (userId: string) => {
      return api.post(`/auth/users/${userId}/move-to-pool`, {});
    },
    onSuccess: () => {
      toast.success('User data moved to company pool');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to move data: ${error.message}`);
    },
  });

  const deactivateUser = useMutation({
    mutationFn: async (userId: string) => {
      return api.post(`/auth/users/${userId}/deactivate`, {});
    },
    onSuccess: () => {
      toast.success('User deactivated and data moved to company pool');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
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

  const { data: poolContacts, isLoading } = useQuery({
    queryKey: ['company-pool'],
    queryFn: async () => {
      return api.get<any[]>('/auth/company-pool');
    },
  });

  const moveOldContactsToPool = useMutation({
    mutationFn: async () => {
      return api.post<{ count: number }>('/auth/company-pool/move-old', {});
    },
    onSuccess: (data) => {
      toast.success(`Moved ${data.count} contacts to company pool`);
      queryClient.invalidateQueries({ queryKey: ['company-pool'] });
    },
    onError: (error: any) => {
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
