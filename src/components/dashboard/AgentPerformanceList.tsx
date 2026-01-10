import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { AgentDailyStats, AllAgentsSummary } from '@/hooks/useAllAgentsPerformance';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface AgentPerformanceListProps {
  agents: AgentDailyStats[];
  isLoading: boolean;
  summary?: AllAgentsSummary;
  dateRangeLabel?: string;
}

export const AgentPerformanceList: React.FC<AgentPerformanceListProps> = ({ 
  agents, 
  isLoading,
  summary,
  dateRangeLabel 
}) => {
  
  const exportToExcel = () => {
    if (agents.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Prepare data for export
    const exportData = agents.map((agent, index) => ({
      'Rank': index + 1,
      'Agent Name': agent.agentName,
      'Total Calls': agent.totalCalls,
      'Interested': agent.interested,
      'Not Interested': agent.notInterested,
      'Not Answered': agent.notAnswered,
      'Leads Generated': agent.leadsGenerated,
      'Conversion Rate (%)': agent.conversionRate,
    }));

    // Add summary row if available
    if (summary) {
      exportData.push({
        'Rank': 0,
        'Agent Name': 'TOTAL',
        'Total Calls': summary.totalCalls,
        'Interested': summary.totalInterested,
        'Not Interested': summary.totalNotInterested,
        'Not Answered': summary.totalNotAnswered,
        'Leads Generated': summary.totalLeads,
        'Conversion Rate (%)': summary.avgConversionRate,
      });
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // Rank
      { wch: 25 }, // Agent Name
      { wch: 12 }, // Total Calls
      { wch: 12 }, // Interested
      { wch: 14 }, // Not Interested
      { wch: 14 }, // Not Answered
      { wch: 16 }, // Leads Generated
      { wch: 18 }, // Conversion Rate
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Team Performance');

    // Generate filename with date
    const filename = `team_performance_${dateRangeLabel?.replace(/[,\s]+/g, '_') || new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    toast.success('Excel file downloaded successfully');
  };

  const exportToCSV = () => {
    if (agents.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Prepare CSV header
    const headers = ['Rank', 'Agent Name', 'Total Calls', 'Interested', 'Not Interested', 'Not Answered', 'Leads Generated', 'Conversion Rate (%)'];
    
    // Prepare data rows
    const rows = agents.map((agent, index) => [
      index + 1,
      agent.agentName,
      agent.totalCalls,
      agent.interested,
      agent.notInterested,
      agent.notAnswered,
      agent.leadsGenerated,
      agent.conversionRate,
    ]);

    // Add summary row if available
    if (summary) {
      rows.push([
        '',
        'TOTAL',
        summary.totalCalls,
        summary.totalInterested,
        summary.totalNotInterested,
        summary.totalNotAnswered,
        summary.totalLeads,
        summary.avgConversionRate,
      ]);
    }

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `team_performance_${dateRangeLabel?.replace(/[,\s]+/g, '_') || new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV file downloaded successfully');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Agent Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No activity recorded for the selected period
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Agent Performance ({agents.length} agents)
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
              <FileText className="w-4 h-4" />
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Interested</TableHead>
              <TableHead className="text-right">Not Interested</TableHead>
              <TableHead className="text-right">Not Answered</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="w-32">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent, index) => (
              <TableRow key={agent.agentId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                      {index + 1}
                    </Badge>
                    <span className="font-medium">{agent.agentName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{agent.totalCalls}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    {agent.interested}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    {agent.notInterested}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="bg-warning/10 text-warning">
                    {agent.notAnswered}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="default">{agent.leadsGenerated}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={agent.conversionRate} className="h-2 flex-1" />
                    <span className="text-xs font-medium w-8">{agent.conversionRate}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
