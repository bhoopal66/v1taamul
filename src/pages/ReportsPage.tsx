import React, { useState } from 'react';
import { ScheduledReportsManager } from '@/components/reports/ScheduledReportsManager';
import { WeeklyReportPDFGenerator } from '@/components/reports/WeeklyReportPDFGenerator';
import { TeamReportGenerator } from '@/components/reports/TeamReportGenerator';
import { AgentHourlyCallReport } from '@/components/reports/AgentHourlyCallReport';
import { BankSubmissionReport } from '@/components/reports/BankSubmissionReport';
import { TeamDailyCallStatusReport } from '@/components/reports/TeamDailyCallStatusReport';
import { DailyAgentCallReport } from '@/components/reports/DailyAgentCallReport';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  Download, 
  Users, 
  Clock, 
  Building, 
  Phone, 
  UserCheck,
  FileBarChart,
  ChevronRight,
  BarChart3,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ReportMenuItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  bgGradient: string;
  requiresTeamLeader?: boolean;
}

const reportMenuItems: ReportMenuItem[] = [
  {
    id: 'agent-daily',
    label: 'Agent Call Report',
    description: 'Agent-wise daily call breakdown',
    icon: UserCheck,
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgGradient: 'from-blue-500/10 to-blue-600/5',
    requiresTeamLeader: true,
  },
  {
    id: 'hourly',
    label: 'Hourly Report',
    description: 'Hour-wise call volume analysis',
    icon: Clock,
    iconColor: 'text-purple-600 dark:text-purple-400',
    bgGradient: 'from-purple-500/10 to-purple-600/5',
    requiresTeamLeader: true,
  },
  {
    id: 'daily-status',
    label: 'Daily Call Status',
    description: 'Team call status overview',
    icon: Phone,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bgGradient: 'from-emerald-500/10 to-emerald-600/5',
    requiresTeamLeader: true,
  },
  {
    id: 'bank-submission',
    label: 'Bank Submissions',
    description: 'Bank-wise submission tracking',
    icon: Building,
    iconColor: 'text-amber-600 dark:text-amber-400',
    bgGradient: 'from-amber-500/10 to-amber-600/5',
    requiresTeamLeader: true,
  },
  {
    id: 'team',
    label: 'Team Report',
    description: 'Comprehensive team analytics',
    icon: Users,
    iconColor: 'text-rose-600 dark:text-rose-400',
    bgGradient: 'from-rose-500/10 to-rose-600/5',
    requiresTeamLeader: true,
  },
  {
    id: 'generate',
    label: 'Weekly Report',
    description: 'Generate weekly PDF reports',
    icon: Download,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    bgGradient: 'from-cyan-500/10 to-cyan-600/5',
    requiresTeamLeader: false,
  },
  {
    id: 'scheduled',
    label: 'Scheduled Reports',
    description: 'Manage automated reports',
    icon: Calendar,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    bgGradient: 'from-indigo-500/10 to-indigo-600/5',
    requiresTeamLeader: false,
  },
];

const ReportsPage: React.FC = () => {
  const { ledTeamId } = useAuth();
  const isTeamLeader = !!ledTeamId;
  
  const availableItems = reportMenuItems.filter(
    item => !item.requiresTeamLeader || isTeamLeader
  );
  
  const [activeReport, setActiveReport] = useState(availableItems[0]?.id || 'generate');

  const renderReportContent = () => {
    switch (activeReport) {
      case 'agent-daily':
        return <DailyAgentCallReport />;
      case 'hourly':
        return <AgentHourlyCallReport />;
      case 'daily-status':
        return <TeamDailyCallStatusReport />;
      case 'bank-submission':
        return <BankSubmissionReport />;
      case 'team':
        return <TeamReportGenerator />;
      case 'generate':
        return <WeeklyReportPDFGenerator />;
      case 'scheduled':
        return <ScheduledReportsManager />;
      default:
        return <WeeklyReportPDFGenerator />;
    }
  };

  const activeItem = availableItems.find(item => item.id === activeReport);

  return (
    <div className="min-h-[calc(100vh-4rem)] animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border mb-6 p-6">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <FileBarChart className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports Center</h1>
            <p className="text-muted-foreground">
              Generate, analyze, and schedule automated performance reports
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute -bottom-4 right-16 h-20 w-20 rounded-full bg-primary/10 blur-xl" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar Navigation */}
        <Card className="h-fit lg:sticky lg:top-4 border-0 shadow-lg bg-gradient-to-b from-card to-card/80">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Report Types
              </span>
            </div>
            
            <ScrollArea className="h-auto max-h-[60vh]">
              <nav className="space-y-1">
                {availableItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeReport === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveReport(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-200",
                        "hover:bg-muted/80 group relative overflow-hidden",
                        isActive && `bg-gradient-to-r ${item.bgGradient} border border-primary/10`
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                        isActive 
                          ? "bg-background shadow-sm" 
                          : "bg-muted/50 group-hover:bg-background group-hover:shadow-sm"
                      )}>
                        <Icon className={cn("h-5 w-5 transition-colors", item.iconColor)} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "font-medium text-sm truncate transition-colors",
                          isActive ? "text-foreground" : "text-foreground/80"
                        )}>
                          {item.label}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </div>
                      </div>
                      
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-200",
                        isActive 
                          ? "opacity-100 translate-x-0" 
                          : "opacity-0 -translate-x-2 group-hover:opacity-70 group-hover:translate-x-0"
                      )} />
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>

            {/* Quick Stats */}
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{availableItems.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Reports</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">Live</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Data</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Content Area */}
        <div className="min-w-0">
          {/* Active Report Header */}
          {activeItem && (
            <div className={cn(
              "flex items-center gap-3 mb-4 p-4 rounded-xl border bg-gradient-to-r",
              activeItem.bgGradient
            )}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
                <activeItem.icon className={cn("h-5 w-5", activeItem.iconColor)} />
              </div>
              <div>
                <h2 className="font-semibold">{activeItem.label}</h2>
                <p className="text-sm text-muted-foreground">{activeItem.description}</p>
              </div>
            </div>
          )}

          {/* Report Component */}
          <div className="animate-fade-in" key={activeReport}>
            {renderReportContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
