import React from 'react';
import { ScheduledReportsManager } from '@/components/reports/ScheduledReportsManager';
import { WeeklyReportPDFGenerator } from '@/components/reports/WeeklyReportPDFGenerator';
import { TeamReportGenerator } from '@/components/reports/TeamReportGenerator';
import { AgentHourlyCallReport } from '@/components/reports/AgentHourlyCallReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Download, Users, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ReportsPage: React.FC = () => {
  const { ledTeamId } = useAuth();
  const isTeamLeader = !!ledTeamId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and schedule automated performance reports
        </p>
      </div>

      <Tabs defaultValue={isTeamLeader ? "hourly" : "generate"} className="space-y-4">
        <TabsList>
          {isTeamLeader && (
            <TabsTrigger value="hourly" className="gap-2">
              <Clock className="h-4 w-4" />
              Hourly Report
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

        {isTeamLeader && (
          <TabsContent value="hourly" className="space-y-4">
            <AgentHourlyCallReport />
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
