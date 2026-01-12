import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, Building2 } from "lucide-react";

const ProfileVisibilityTest = () => {
  const { user, userRole, profile } = useAuth();

  const { data: visibleProfiles, isLoading } = useQuery({
    queryKey: ['visible-profiles-test'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          username,
          email,
          team_id,
          supervisor_id
        `)
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, leader_id');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getTeamName = (teamId: string | null) => {
    if (!teamId || !teams) return '-';
    const team = teams.find(t => t.id === teamId);
    return team?.name || '-';
  };

  const getUserRoles = (userId: string) => {
    if (!userRoles) return [];
    return userRoles.filter(r => r.user_id === userId).map(r => r.role);
  };

  const isTeamLeader = (userId: string) => {
    if (!teams) return false;
    return teams.some(t => t.leader_id === userId);
  };

  return (
    <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Profile Visibility Test</h1>
          <p className="text-muted-foreground">
            This page shows all profiles visible to the current user based on RLS policies.
          </p>
        </div>

        {/* Current User Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current User Context
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{profile?.full_name || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Role:</span>
                <Badge variant="outline" className="mt-1">{userRole || 'none'}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">User ID:</span>
                <p className="font-mono text-xs break-all">{user?.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visible Profiles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Visible Profiles
              {visibleProfiles && (
                <Badge variant="secondary" className="ml-2">
                  {visibleProfiles.length} profiles
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : visibleProfiles && visibleProfiles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead className="text-xs">User ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleProfiles.map((p) => (
                    <TableRow 
                      key={p.id}
                      className={p.id === user?.id ? "bg-primary/10" : ""}
                    >
                      <TableCell className="font-medium">
                        {p.full_name}
                        {p.id === user?.id && (
                          <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                        )}
                      </TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {getTeamName(p.team_id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getUserRoles(p.id).map(role => (
                            <Badge key={role} variant="secondary" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isTeamLeader(p.id) ? (
                          <Badge variant="default" className="text-xs">Leader</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.id.slice(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No profiles visible to this user.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Expected Behavior Info */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Expected RLS Behavior</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>Supervisors</strong> should see:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 text-muted-foreground">
              <li>Their own profile</li>
              <li>Profiles in the team they lead (via teams.leader_id)</li>
              <li>Their direct reports (profiles.supervisor_id = their id)</li>
            </ul>
            <p className="mt-3"><strong>Operations Head / Admin / Super Admin</strong> should see:</p>
            <ul className="list-disc list-inside ml-4 text-muted-foreground">
              <li>All profiles</li>
            </ul>
            <p className="mt-3"><strong>Agents</strong> should see:</p>
            <ul className="list-disc list-inside ml-4 text-muted-foreground">
              <li>Only their own profile</li>
            </ul>
          </CardContent>
        </Card>
      </div>
  );
};

export default ProfileVisibilityTest;
