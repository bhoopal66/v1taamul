import React from 'react';
import { ScheduledReportsManager } from '@/components/reports/ScheduledReportsManager';
import { WeeklyReportPDFGenerator } from '@/components/reports/WeeklyReportPDFGenerator';
import { TeamReportGenerator } from '@/components/reports/TeamReportGenerator';
import { AgentHourlyCallReport } from '@/components/reports/AgentHourlyCallReport';
import { BankSubmissionReport } from '@/components/reports/BankSubmissionReport';
import { TeamDailyCallStatusReport } from '@/components/reports/TeamDailyCallStatusReport';
import { DailyAgentCallReport } from '@/components/reports/DailyAgentCallReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Download, Users, Clock, Building, Phone, UserCheck } from 'lucide-react';
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

      <Tabs defaultValue={isTeamLeader ? "agent-daily" : "generate"} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {isTeamLeader && (
            <TabsTrigger value="agent-daily" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Agent Call Report
            </TabsTrigger>
          )}
          {isTeamLeader && (
            <TabsTrigger value="hourly" className="gap-2">
              <Clock className="h-4 w-4" />
              Hourly Report
            </TabsTrigger>
          )}
          {isTeamLeader && (
            <TabsTrigger value="daily-status" className="gap-2">
              <Phone className="h-4 w-4" />
              Daily Call Status
            </TabsTrigger>
          )}
          {isTeamLeader && (
            <TabsTrigger value="bank-submission" className="gap-2">
              <Building className="h-4 w-4" />
              Bank Submissions
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
          <TabsContent value="agent-daily" className="space-y-4">
            <DailyAgentCallReport />
          </TabsContent>
        )}

        {isTeamLeader && (
          <TabsContent value="hourly" className="space-y-4">
            <AgentHourlyCallReport />
          </TabsContent>
        )}

        {isTeamLeader && (
          <TabsContent value="daily-status" className="space-y-4">
            <TeamDailyCallStatusReport />
          </TabsContent>
        )}

        {isTeamLeader && (
          <TabsContent value="bank-submission" className="space-y-4">
            <BankSubmissionReport />
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
