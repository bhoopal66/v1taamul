import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTeamManagement, Team, TeamMember } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Pencil, Trash2, Building2, Wifi, UserPlus, Crown, Search, BarChart3, Bell, ArrowRightLeft, Eye, UserMinus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamPerformanceCharts } from '@/components/teams/TeamPerformanceCharts';
import { PerformanceTargetsManager } from '@/components/teams/PerformanceTargetsManager';
import { PerformanceAlertsList } from '@/components/teams/PerformanceAlertsList';
import { usePerformanceAlerts } from '@/hooks/usePerformanceAlerts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePermissions } from '@/hooks/usePermissions';

export const TeamManagementPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'teams';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const {
    teams, 
    agents, 
    isLoading, 
    isAdmin,
    createTeam, 
    updateTeam, 
    deleteTeam, 
    assignAgentToTeam,
    bulkAssignAgents 
  } = useTeamManagement();

  const { canDeleteTeams } = usePermissions();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTeamForAssign, setSelectedTeamForAssign] = useState<Team | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMembersTeam, setViewMembersTeam] = useState<Team | null>(null);
  const [movingAgent, setMovingAgent] = useState<TeamMember | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'remote' | 'office'>('office');
  const [formLeaderId, setFormLeaderId] = useState<string>('');

  const resetForm = () => {
    setFormName('');
    setFormType('office');
    setFormLeaderId('');
  };

  const handleCreateTeam = () => {
    if (!formName.trim()) return;
    createTeam.mutate({
      name: formName.trim(),
      team_type: formType,
      leader_id: formLeaderId || undefined,
    });
    setCreateDialogOpen(false);
    resetForm();
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setFormName(team.name);
    setFormType(team.team_type);
    setFormLeaderId(team.leader_id || '');
  };

  const handleUpdateTeam = () => {
    if (!editingTeam || !formName.trim()) return;
    updateTeam.mutate({
      id: editingTeam.id,
      name: formName.trim(),
      team_type: formType,
      leader_id: formLeaderId || null,
    });
    setEditingTeam(null);
    resetForm();
  };

  const handleDeleteTeam = (teamId: string) => {
    deleteTeam.mutate(teamId);
  };

  const handleOpenAssignDialog = (team: Team) => {
    setSelectedTeamForAssign(team);
    setSelectedAgents([]);
    setAssignDialogOpen(true);
  };

  const handleBulkAssign = () => {
    if (!selectedTeamForAssign || selectedAgents.length === 0) return;
    bulkAssignAgents.mutate({
      agentIds: selectedAgents,
      teamId: selectedTeamForAssign.id,
    });
    setAssignDialogOpen(false);
    setSelectedAgents([]);
  };

  const handleRemoveFromTeam = (agentId: string) => {
    assignAgentToTeam.mutate({ agentId, teamId: null });
  };

  const handleMoveAgent = (agentId: string, newTeamId: string) => {
    assignAgentToTeam.mutate({ agentId, teamId: newTeamId });
    setMovingAgent(null);
  };

  const getTeamMembers = (teamId: string) => {
    return agents.filter(a => a.team_id === teamId);
  };

  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  const filteredAgents = agents.filter(agent => {
    const searchLower = searchQuery.toLowerCase();
    return (
      agent.full_name?.toLowerCase().includes(searchLower) ||
      agent.username.toLowerCase().includes(searchLower) ||
      agent.email.toLowerCase().includes(searchLower)
    );
  });

  const unassignedAgents = filteredAgents.filter(a => !a.team_id);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to manage teams.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground">Create teams, assign leaders, and manage agent assignments.</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>Set up a new team with a name, type, and optional leader.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="e.g., John's Team"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-type">Team Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as 'remote' | 'office')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Office
                      </div>
                    </SelectItem>
                    <SelectItem value="remote">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4" />
                        Remote
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-leader">Team Leader (Optional)</Label>
                <Select value={formLeaderId || "none"} onValueChange={(v) => setFormLeaderId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a leader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No leader assigned</SelectItem>
                    {agents.filter(a => a.is_active).map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name || agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTeam} disabled={!formName.trim()}>Create Team</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Office Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.filter(t => t.team_type === 'office').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remote Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.filter(t => t.team_type === 'remote').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.filter(a => !a.team_id).length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="w-4 h-4" />
            Teams ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Agents ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="w-4 h-4" />
            Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <TeamPerformanceCharts />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <PerformanceTargetsManager />
          <PerformanceAlertsList />
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          {/* Teams Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map(team => (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {team.name}
                        <Badge variant={team.team_type === 'remote' ? 'secondary' : 'outline'} className="text-xs">
                          {team.team_type === 'remote' ? (
                            <><Wifi className="w-3 h-3 mr-1" /> Remote</>
                          ) : (
                            <><Building2 className="w-3 h-3 mr-1" /> Office</>
                          )}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Leader: {team.leader_name || 'Not assigned'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditTeam(team)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {canDeleteTeams && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Team?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the team and unassign all {team.member_count} members. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTeam(team.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {team.member_count} / 12 members
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewMembersTeam(team)} disabled={team.member_count === 0}>
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleOpenAssignDialog(team)}>
                        <UserPlus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                  {team.member_count > 0 && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all" 
                        style={{ width: `${Math.min((team.member_count / 12) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                  {/* Quick preview of members */}
                  {team.member_count > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      <div className="flex -space-x-2">
                        {getTeamMembers(team.id).slice(0, 4).map(member => (
                          <Avatar key={member.id} className="w-7 h-7 border-2 border-background">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(member.full_name, member.username)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {team.member_count > 4 && (
                          <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">+{team.member_count - 4}</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="ml-auto text-xs h-7 px-2"
                        onClick={() => setViewMembersTeam(team)}
                      >
                        Manage
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {teams.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No teams created yet.</p>
                  <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Team
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Agents Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map(agent => {
                  const team = teams.find(t => t.id === agent.team_id);
                  return (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">
                        {agent.full_name || agent.username}
                        {team?.leader_id === agent.id && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            Leader
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{agent.email}</TableCell>
                      <TableCell>
                        {team ? (
                          <Badge variant="outline">{team.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                          {agent.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.team_id ? (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveFromTeam(agent.id)}
                          >
                            Remove
                          </Button>
                        ) : (
                          <Select onValueChange={(teamId) => assignAgentToTeam.mutate({ agentId: agent.id, teamId })}>
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Assign to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.map(team => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Team Dialog */}
      <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update team details and leader assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team Name</Label>
              <Input
                id="edit-team-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-type">Team Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as 'remote' | 'office')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Office
                    </div>
                  </SelectItem>
                  <SelectItem value="remote">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4" />
                      Remote
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-leader">Team Leader</Label>
              <Select value={formLeaderId || "none"} onValueChange={(v) => setFormLeaderId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No leader assigned</SelectItem>
                  {agents.filter(a => a.is_active).map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name || agent.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTeam(null)}>Cancel</Button>
            <Button onClick={handleUpdateTeam} disabled={!formName.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Agents to {selectedTeamForAssign?.name}</DialogTitle>
            <DialogDescription>
              Select agents to add to this team. Current members: {selectedTeamForAssign?.member_count}/12
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto space-y-2">
            {unassignedAgents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">All agents are already assigned to teams.</p>
            ) : (
              unassignedAgents.map(agent => (
                <div key={agent.id} className="flex items-center space-x-3 p-2 rounded hover:bg-muted">
                  <Checkbox
                    id={agent.id}
                    checked={selectedAgents.includes(agent.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedAgents([...selectedAgents, agent.id]);
                      } else {
                        setSelectedAgents(selectedAgents.filter(id => id !== agent.id));
                      }
                    }}
                  />
                  <label htmlFor={agent.id} className="flex-1 cursor-pointer">
                    <p className="font-medium">{agent.full_name || agent.username}</p>
                    <p className="text-sm text-muted-foreground">{agent.email}</p>
                  </label>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={selectedAgents.length === 0}>
              Assign {selectedAgents.length} Agent{selectedAgents.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Team Details Dialog */}
      <Dialog open={!!viewMembersTeam} onOpenChange={(open) => !open && setViewMembersTeam(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {viewMembersTeam?.name} - Team Details
            </DialogTitle>
            <DialogDescription>
              Complete team overview with leader, members, and quick actions.
            </DialogDescription>
          </DialogHeader>
          
          {viewMembersTeam && (
            <>
              {/* Team Info Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                {/* Team Leader Card */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Crown className="w-4 h-4 text-primary" />
                      Team Leader
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {viewMembersTeam.leader_id ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                            {getInitials(viewMembersTeam.leader_name || null, viewMembersTeam.leader_name || 'TL')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm">{viewMembersTeam.leader_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {agents.find(a => a.id === viewMembersTeam.leader_id)?.email || ''}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not assigned</p>
                    )}
                  </CardContent>
                </Card>

                {/* Team Type Card */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Team Type</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex items-center gap-2">
                      {viewMembersTeam.team_type === 'remote' ? (
                        <Wifi className="w-5 h-5 text-info" />
                      ) : (
                        <Building2 className="w-5 h-5 text-info" />
                      )}
                      <span className="font-semibold capitalize">{viewMembersTeam.team_type}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Member Stats Card */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-lg">{viewMembersTeam.member_count} / 12</span>
                      <div className="flex gap-2 text-xs">
                        <Badge variant="default" className="text-xs">
                          {getTeamMembers(viewMembersTeam.id).filter(m => m.is_active).length} active
                        </Badge>
                        {getTeamMembers(viewMembersTeam.id).filter(m => !m.is_active).length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {getTeamMembers(viewMembersTeam.id).filter(m => !m.is_active).length} inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Members Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[250px]">Agent</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="text-right w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTeamMembers(viewMembersTeam.id).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No members in this team yet.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      getTeamMembers(viewMembersTeam.id).map(member => (
                        <TableRow key={member.id} className={!member.is_active ? 'opacity-60' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className={`text-xs font-medium ${viewMembersTeam.leader_id === member.id ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                                  {getInitials(member.full_name, member.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {member.full_name || member.username}
                                  {viewMembersTeam.leader_id === member.id && (
                                    <Crown className="w-3.5 h-3.5 text-primary" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">@{member.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {member.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.is_active ? 'default' : 'secondary'} className="text-xs">
                              {member.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setMovingAgent(member)}
                                className="h-7 px-2"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveFromTeam(member.id)}
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewMembersTeam(null)}>Close</Button>
            <Button onClick={() => {
              if (viewMembersTeam) {
                handleOpenAssignDialog(viewMembersTeam);
                setViewMembersTeam(null);
              }
            }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Agent Dialog */}
      <Dialog open={!!movingAgent} onOpenChange={(open) => !open && setMovingAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Move {movingAgent?.full_name || movingAgent?.username}
            </DialogTitle>
            <DialogDescription>
              Select a new team for this agent.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {teams.filter(t => t.id !== movingAgent?.team_id).length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No other teams available.</p>
            ) : (
              teams.filter(t => t.id !== movingAgent?.team_id).map(team => (
                <button
                  key={team.id}
                  onClick={() => movingAgent && handleMoveAgent(movingAgent.id, team.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-primary/5 hover:border-primary/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {team.team_type === 'remote' ? (
                        <Wifi className="w-5 h-5 text-primary" />
                      ) : (
                        <Building2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {team.member_count} members • {team.leader_name || 'No leader'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">{team.team_type}</Badge>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovingAgent(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManagementPage;
