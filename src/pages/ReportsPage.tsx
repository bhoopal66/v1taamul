import React from 'react';
import { ScheduledReportsManager } from '@/components/reports/ScheduledReportsManager';
import { WeeklyReportPDFGenerator } from '@/components/reports/WeeklyReportPDFGenerator';
import { TeamReportGenerator } from '@/components/reports/TeamReportGenerator';
import { ApprovedLeadsExport } from '@/components/reports/ApprovedLeadsExport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Download, Users, FileCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ReportsPage: React.FC = () => {
  const { ledTeamId, userRole } = useAuth();
  const isTeamLeader = !!ledTeamId;
  const canExportApprovedLeads = userRole === 'admin' || userRole === 'super_admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and schedule automated performance reports
        </p>
      </div>

      <Tabs defaultValue={canExportApprovedLeads ? "approved" : (isTeamLeader ? "team" : "generate")} className="space-y-4">
        <TabsList className="flex-wrap">
          {canExportApprovedLeads && (
            <TabsTrigger value="approved" className="gap-2">
              <FileCheck className="h-4 w-4" />
              Approved Leads Export
            </TabsTrigger>
          )}
          {isTeamLeader && (
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              Team Report
            </TabsTrigger>
          )}
          <TabsTrigger value="generate" className="gap-2">
            <Download className="h-4 w-4" />
            Weekly Report
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Calendar className="h-4 w-4" />
            Scheduled Reports
          </TabsTrigger>
        </TabsList>

        {canExportApprovedLeads && (
          <TabsContent value="approved" className="space-y-4">
            <ApprovedLeadsExport />
          </TabsContent>
        )}

        {isTeamLeader && (
          <TabsContent value="team" className="space-y-4">
            <TeamReportGenerator />
          </TabsContent>
        )}

        <TabsContent value="generate" className="space-y-4">
          <WeeklyReportPDFGenerator />
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <ScheduledReportsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
