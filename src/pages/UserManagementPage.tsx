import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  Download,
  Database,
  Search,
  MoreVertical,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
  AlertTriangle,
  UserPlus,
  Edit2,
} from 'lucide-react';
import { useUserManagement, useCompanyPool, UserWithRole } from '@/hooks/useUserManagement';
import { exportUserDataToExcel } from '@/utils/userDataExport';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Database as DBTypes } from '@/integrations/supabase/types';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AppRole = DBTypes['public']['Enums']['app_role'];

const roleLabels: Record<AppRole, { label: string; color: string }> = {
  agent: { label: 'Agent', color: 'bg-gray-500/10 text-gray-600' },
  supervisor: { label: 'Supervisor', color: 'bg-blue-500/10 text-blue-600' },
  operations_head: { label: 'Ops Head', color: 'bg-purple-500/10 text-purple-600' },
  admin: { label: 'Admin', color: 'bg-orange-500/10 text-orange-600' },
  super_admin: { label: 'Super Admin', color: 'bg-red-500/10 text-red-600' },
  sales_controller: { label: 'Sales Controller', color: 'bg-green-500/10 text-green-600' },
};

const availableRoles: AppRole[] = ['agent', 'supervisor', 'operations_head', 'admin', 'super_admin', 'sales_controller'];

export const UserManagementPage: React.FC = () => {
  const { profile, userRole } = useAuth();
  const { 
    users, 
    isLoading, 
    addRole, 
    removeRole, 
    toggleUserActive,
    exportUserData,
    moveUserDataToPool,
    deactivateUser,
    isUpdating 
  } = useUserManagement();
  const { poolContacts, moveOldContactsToPool, isMoving } = useCompanyPool();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'deactivate' | 'export' | 'move_to_pool' | null;
    user: UserWithRole | null;
  }>({ open: false, action: null, user: null });
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<AppRole | null>(null);
  
  // Create user state
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'agent' as AppRole,
  });

  // Edit user state
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    id: '',
    full_name: '',
    username: '',
    phone_number: '',
    whatsapp_number: '',
  });

  // Check if current user has admin access
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSuperAdmin = userRole === 'super_admin';

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportUserData = async (user: UserWithRole) => {
    const data = await exportUserData(user.id);
    if (data) {
      exportUserDataToExcel(data);
    }
    setConfirmDialog({ open: false, action: null, user: null });
  };

  const handleDeactivateUser = (user: UserWithRole) => {
    deactivateUser(user.id);
    setConfirmDialog({ open: false, action: null, user: null });
  };

  const handleMoveToPool = (user: UserWithRole) => {
    moveUserDataToPool(user.id);
    setConfirmDialog({ open: false, action: null, user: null });
  };

  const handleAddRole = () => {
    if (selectedUser && selectedRoleToAdd) {
      addRole({ userId: selectedUser.id, role: selectedRoleToAdd });
      setRoleDialogOpen(false);
      setSelectedRoleToAdd(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.email || !newUserForm.password || !newUserForm.fullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (newUserForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserForm.email,
          password: newUserForm.password,
          fullName: newUserForm.fullName,
          role: newUserForm.role,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`User ${newUserForm.email} created successfully`);
      setCreateUserDialogOpen(false);
      setNewUserForm({ email: '', password: '', fullName: '', role: 'agent' });
      
      // Refresh user list
      window.location.reload();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      toast.error(message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditUserForm({
      id: user.id,
      full_name: user.full_name || '',
      username: user.username || '',
      phone_number: user.phone_number || '',
      whatsapp_number: user.whatsapp_number || '',
    });
    setEditUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editUserForm.id) return;
    
    setIsSavingUser(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editUserForm.full_name,
          username: editUserForm.username,
          phone_number: editUserForm.phone_number || null,
          whatsapp_number: editUserForm.whatsapp_number || null,
        })
        .eq('id', editUserForm.id);
      
      if (error) throw error;
      
      toast.success('User profile updated successfully');
      setEditUserDialogOpen(false);
      
      // Refresh user list
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setIsSavingUser(false);
    }
  };

  const canManageRole = (role: AppRole): boolean => {
    if (isSuperAdmin) return true;
    if (role === 'admin' || role === 'super_admin') return false;
    return true;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage users, roles, and company data pool
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setCreateUserDialogOpen(true)}
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Create User
          </Button>
          <Button 
            variant="outline" 
            onClick={() => moveOldContactsToPool()}
            disabled={isMoving}
            className="gap-2"
          >
            {isMoving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Move Old to Pool
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users ({users.length})
          </TabsTrigger>
          <TabsTrigger value="pool" className="gap-2">
            <Database className="w-4 h-4" />
            Company Pool ({poolContacts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{user.full_name || user.username}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles.length === 0 ? (
                                <Badge variant="outline" className="text-muted-foreground">No roles</Badge>
                              ) : (
                                user.roles.map((role) => (
                                  <Badge 
                                    key={role} 
                                    variant="outline" 
                                    className={cn("gap-1", roleLabels[role]?.color)}
                                  >
                                    {roleLabels[role]?.label || role}
                                    {canManageRole(role) && (
                                      <button
                                        onClick={() => removeRole({ userId: user.id, role })}
                                        className="hover:text-destructive ml-1"
                                        disabled={isUpdating}
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                    )}
                                  </Badge>
                                ))
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setRoleDialogOpen(true);
                                }}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={user.is_active ?? true}
                                onCheckedChange={(checked) => 
                                  toggleUserActive({ userId: user.id, isActive: checked })
                                }
                                disabled={isUpdating}
                              />
                              <span className={cn(
                                "text-sm",
                                user.is_active ? "text-green-600" : "text-muted-foreground"
                              )}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.last_login 
                              ? format(new Date(user.last_login), 'MMM d, yyyy HH:mm')
                              : 'Never'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Edit Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setConfirmDialog({ 
                                    open: true, 
                                    action: 'export', 
                                    user 
                                  })}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Export Data
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setConfirmDialog({ 
                                    open: true, 
                                    action: 'move_to_pool', 
                                    user 
                                  })}
                                >
                                  <Database className="w-4 h-4 mr-2" />
                                  Move Data to Pool
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => setConfirmDialog({ 
                                    open: true, 
                                    action: 'deactivate', 
                                    user 
                                  })}
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  Deactivate & Move Data
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pool" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Company Data Pool
              </CardTitle>
              <CardDescription>
                Contacts older than 1 month or from deactivated users. All agents can use these for calls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City / Area</TableHead>
                      <TableHead>Added to Pool</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.company_name}</TableCell>
                        <TableCell>{contact.contact_person_name}</TableCell>
                        <TableCell className="font-mono text-sm">{contact.phone_number}</TableCell>
                        <TableCell>
                          {contact.city && <span>{contact.city}</span>}
                          {contact.city && contact.area && <span> / </span>}
                          {contact.area && <span>{contact.area}</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {contact.pool_entry_date 
                            ? format(new Date(contact.pool_entry_date), 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {poolContacts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No contacts in the company pool yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Add a new role to {selectedUser?.full_name || selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select 
              value={selectedRoleToAdd || undefined} 
              onValueChange={(value) => setSelectedRoleToAdd(value as AppRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles
                  .filter(role => !selectedUser?.roles.includes(role) && canManageRole(role))
                  .map(role => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]?.label || role}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRole} disabled={!selectedRoleToAdd || isUpdating}>
              Add Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {confirmDialog.action === 'deactivate' && 'Deactivate User'}
              {confirmDialog.action === 'export' && 'Export User Data'}
              {confirmDialog.action === 'move_to_pool' && 'Move Data to Pool'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === 'deactivate' && (
                <>
                  This will deactivate <strong>{confirmDialog.user?.full_name || confirmDialog.user?.username}</strong> and 
                  move all their contacts to the company pool. The user will no longer be able to log in.
                </>
              )}
              {confirmDialog.action === 'export' && (
                <>
                  Export all data for <strong>{confirmDialog.user?.full_name || confirmDialog.user?.username}</strong> including 
                  contacts, call feedback, leads, and uploads.
                </>
              )}
              {confirmDialog.action === 'move_to_pool' && (
                <>
                  Move all contacts uploaded by <strong>{confirmDialog.user?.full_name || confirmDialog.user?.username}</strong> to 
                  the company pool. All agents will be able to access these contacts.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ open: false, action: null, user: null })}
            >
              Cancel
            </Button>
            {confirmDialog.action === 'deactivate' && confirmDialog.user && (
              <Button 
                variant="destructive" 
                onClick={() => handleDeactivateUser(confirmDialog.user!)}
                disabled={isUpdating}
              >
                Deactivate User
              </Button>
            )}
            {confirmDialog.action === 'export' && confirmDialog.user && (
              <Button 
                onClick={() => handleExportUserData(confirmDialog.user!)}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            )}
            {confirmDialog.action === 'move_to_pool' && confirmDialog.user && (
              <Button 
                onClick={() => handleMoveToPool(confirmDialog.user!)}
                disabled={isUpdating}
              >
                <Database className="w-4 h-4 mr-2" />
                Move to Pool
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new user account with a specific role. The user will be able to log in immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm(f => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={newUserForm.role} 
                onValueChange={(value) => setNewUserForm(f => ({ ...f, role: value as AppRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.filter(role => canManageRole(role)).map(role => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs", roleLabels[role]?.color)}>
                          {roleLabels[role]?.label || role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={isCreatingUser}>
              {isCreatingUser ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" />
              Edit User Profile
            </DialogTitle>
            <DialogDescription>
              Update user profile information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                placeholder="John Doe"
                value={editUserForm.full_name}
                onChange={(e) => setEditUserForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                placeholder="johndoe"
                value={editUserForm.username}
                onChange={(e) => setEditUserForm(f => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                placeholder="+971 50 123 4567"
                value={editUserForm.phone_number}
                onChange={(e) => setEditUserForm(f => ({ ...f, phone_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp">WhatsApp Number</Label>
              <Input
                id="edit-whatsapp"
                placeholder="+971 50 123 4567"
                value={editUserForm.whatsapp_number}
                onChange={(e) => setEditUserForm(f => ({ ...f, whatsapp_number: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isSavingUser}>
              {isSavingUser ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
