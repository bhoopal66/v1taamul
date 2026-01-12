import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PAGE_PERMISSIONS, FEATURE_PERMISSIONS, PagePermission, FeaturePermission } from '@/config/rolePermissions';
import { Database } from '@/integrations/supabase/types';
import { Check, X, Shield, FileText, Users, Settings } from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];

const ALL_ROLES: AppRole[] = ['agent', 'coordinator', 'supervisor', 'operations_head', 'sales_controller', 'admin', 'super_admin'];

const ROLE_LABELS: Record<AppRole, string> = {
  agent: 'Agent',
  coordinator: 'Coordinator',
  supervisor: 'Supervisor',
  operations_head: 'Ops Head',
  sales_controller: 'Sales Ctrl',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const SECTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  main: { label: 'Main Navigation', icon: <FileText className="h-4 w-4" /> },
  team: { label: 'Team Section', icon: <Users className="h-4 w-4" /> },
  management: { label: 'Management', icon: <Settings className="h-4 w-4" /> },
  admin: { label: 'Administration', icon: <Shield className="h-4 w-4" /> },
};

const PermissionIndicator = ({ allowed }: { allowed: boolean }) => (
  allowed ? (
    <div className="flex justify-center">
      <Check className="h-4 w-4 text-green-500" />
    </div>
  ) : (
    <div className="flex justify-center">
      <X className="h-4 w-4 text-muted-foreground/40" />
    </div>
  )
);

const PagePermissionsTable = () => {
  // Group pages by section
  const groupedPages = PAGE_PERMISSIONS.reduce((acc, page) => {
    const section = page.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(page);
    return acc;
  }, {} as Record<string, PagePermission[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedPages).map(([section, pages]) => (
        <Card key={section}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {SECTION_LABELS[section]?.icon}
              {SECTION_LABELS[section]?.label || section}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Page</TableHead>
                  {ALL_ROLES.map(role => (
                    <TableHead key={role} className="text-center w-[100px]">
                      <Badge variant="outline" className="text-xs">
                        {ROLE_LABELS[role]}
                      </Badge>
                    </TableHead>
                  ))}
                  <TableHead className="w-[100px] text-center">Team Leader</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map(page => (
                  <TableRow key={`${page.path}-${page.section}`}>
                    <TableCell className="font-medium">
                      <div>
                        <span>{page.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {page.path}
                        </span>
                      </div>
                    </TableCell>
                    {ALL_ROLES.map(role => (
                      <TableCell key={role} className="text-center">
                        <PermissionIndicator allowed={page.allowedRoles.includes(role)} />
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      {page.requiresTeamLeader ? (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const FeaturePermissionsTable = () => {
  // Group features by category
  const categories = {
    export: FEATURE_PERMISSIONS.filter(f => f.feature.startsWith('export')),
    user_management: FEATURE_PERMISSIONS.filter(f => 
      ['create_user', 'delete_user', 'change_user_role', 'reset_user_password'].includes(f.feature)
    ),
    team_management: FEATURE_PERMISSIONS.filter(f => 
      ['create_team', 'delete_team', 'assign_team_leader', 'assign_team_members'].includes(f.feature)
    ),
    performance: FEATURE_PERMISSIONS.filter(f => f.feature.includes('performance_target')),
    approvals: FEATURE_PERMISSIONS.filter(f => f.feature.startsWith('approve')),
    reports: FEATURE_PERMISSIONS.filter(f => 
      ['generate_team_report', 'schedule_reports'].includes(f.feature)
    ),
    visibility: FEATURE_PERMISSIONS.filter(f => f.feature.startsWith('view_')),
  };

  const categoryLabels: Record<string, string> = {
    export: 'Data Export',
    user_management: 'User Management',
    team_management: 'Team Management',
    performance: 'Performance Targets',
    approvals: 'Approvals',
    reports: 'Reports',
    visibility: 'Data Visibility',
  };

  return (
    <div className="space-y-6">
      {Object.entries(categories).map(([category, features]) => (
        features.length > 0 && (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{categoryLabels[category]}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Feature</TableHead>
                    {ALL_ROLES.map(role => (
                      <TableHead key={role} className="text-center w-[100px]">
                        <Badge variant="outline" className="text-xs">
                          {ROLE_LABELS[role]}
                        </Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features.map(feature => (
                    <TableRow key={feature.feature}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{feature.description}</span>
                          <span className="text-xs text-muted-foreground block">
                            {feature.feature}
                          </span>
                        </div>
                      </TableCell>
                      {ALL_ROLES.map(role => (
                        <TableCell key={role} className="text-center">
                          <PermissionIndicator allowed={feature.allowedRoles.includes(role)} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ))}
    </div>
  );
};

const RoleSummaryCards = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {ALL_ROLES.map(role => {
        const pageCount = PAGE_PERMISSIONS.filter(p => p.allowedRoles.includes(role)).length;
        const featureCount = FEATURE_PERMISSIONS.filter(f => f.allowedRoles.includes(role)).length;
        
        return (
          <Card key={role}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{ROLE_LABELS[role]}</CardTitle>
              <CardDescription className="text-xs">{role}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{pageCount}</div>
                  <div className="text-xs text-muted-foreground">Pages</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{featureCount}</div>
                  <div className="text-xs text-muted-foreground">Features</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default function PermissionsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Permissions Overview</h1>
          <p className="text-muted-foreground">
            View role-based access control for pages and features
          </p>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="pages">Page Access</TabsTrigger>
          <TabsTrigger value="features">Feature Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <RoleSummaryCards />
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <PagePermissionsTable />
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <FeaturePermissionsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
