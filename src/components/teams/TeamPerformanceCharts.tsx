import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTeamPerformance, TeamPerformanceData } from '@/hooks/useTeamPerformance';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie, Cell } from 'recharts';
import { Phone, Target, TrendingUp, Trophy, AlertTriangle, Building2, Wifi, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--info))'];

export const TeamPerformanceCharts: React.FC = () => {
  const [days, setDays] = useState(30);
  const { teamPerformance, summary, isLoading } = useTeamPerformance({ days });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (teamPerformance.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No team performance data available yet.</p>
          <p className="text-sm text-muted-foreground">Create teams and assign agents to see comparisons.</p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const barChartData = teamPerformance.map(team => ({
    name: team.teamName.length > 12 ? team.teamName.slice(0, 12) + '...' : team.teamName,
    fullName: team.teamName,
    calls: team.totalCalls,
    interested: team.interested,
    leads: team.leadsGenerated,
    conversion: team.conversionRate,
    type: team.teamType,
  }));

  const pieChartData = [
    { name: 'Office Teams', value: teamPerformance.filter(t => t.teamType === 'office').reduce((sum, t) => sum + t.totalCalls, 0) },
    { name: 'Remote Teams', value: teamPerformance.filter(t => t.teamType === 'remote').reduce((sum, t) => sum + t.totalCalls, 0) },
  ].filter(d => d.value > 0);

  // Radar chart data (normalized scores for top 5 teams)
  const topTeams = teamPerformance.slice(0, 5);
  const maxCalls = Math.max(...topTeams.map(t => t.totalCalls), 1);
  const maxLeads = Math.max(...topTeams.map(t => t.leadsGenerated), 1);
  const maxConversion = Math.max(...topTeams.map(t => t.conversionRate), 1);

  const radarData = [
    { metric: 'Calls', ...Object.fromEntries(topTeams.map(t => [t.teamName, Math.round((t.totalCalls / maxCalls) * 100)])) },
    { metric: 'Leads', ...Object.fromEntries(topTeams.map(t => [t.teamName, Math.round((t.leadsGenerated / maxLeads) * 100)])) },
    { metric: 'Conversion', ...Object.fromEntries(topTeams.map(t => [t.teamName, Math.round((t.conversionRate / maxConversion) * 100)])) },
    { metric: 'Interested', ...Object.fromEntries(topTeams.map(t => [t.teamName, t.totalCalls > 0 ? Math.round((t.interested / t.totalCalls) * 100) : 0])) },
    { metric: 'Efficiency', ...Object.fromEntries(topTeams.map(t => [t.teamName, Math.min(t.avgCallsPerAgent, 100)])) },
  ];

  const exportToCSV = () => {
    try {
      const exportData = teamPerformance.map(team => ({
        'Team Name': team.teamName,
        'Type': team.teamType === 'remote' ? 'Remote' : 'Office',
        'Members': team.memberCount,
        'Total Calls': team.totalCalls,
        'Interested': team.interested,
        'Not Interested': team.notInterested,
        'Not Answered': team.notAnswered,
        'Leads Generated': team.leadsGenerated,
        'Conversion Rate (%)': team.conversionRate,
        'Avg Calls/Agent': team.avgCallsPerAgent,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Team Performance');
      XLSX.writeFile(wb, `team_performance_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const currentDate = format(new Date(), 'MMMM d, yyyy');
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Team Performance Report', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${currentDate}`, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Period: Last ${days} days`, pageWidth / 2, 35, { align: 'center' });

      // Summary section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 14, 50);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Calls: ${summary.totalCalls.toLocaleString()}`, 14, 60);
      doc.text(`Total Leads: ${summary.totalLeads.toLocaleString()}`, 14, 68);
      doc.text(`Average Conversion Rate: ${summary.avgConversionRate}%`, 14, 76);
      doc.text(`Best Performing Team: ${summary.bestTeam || 'N/A'}`, 14, 84);
      doc.text(`Needs Attention: ${summary.worstTeam || 'N/A'}`, 14, 92);

      // Team details table
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Team Details', 14, 108);

      // Table headers
      const startY = 118;
      const colWidths = [40, 20, 18, 22, 22, 22, 22, 22];
      const headers = ['Team', 'Type', 'Members', 'Calls', 'Interested', 'Leads', 'Conv %', 'Avg/Agent'];
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      let xPos = 14;
      headers.forEach((header, i) => {
        doc.text(header, xPos, startY);
        xPos += colWidths[i];
      });

      // Table rows
      doc.setFont('helvetica', 'normal');
      let yPos = startY + 8;
      
      teamPerformance.forEach((team, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        xPos = 14;
        const row = [
          team.teamName.length > 18 ? team.teamName.slice(0, 18) + '...' : team.teamName,
          team.teamType === 'remote' ? 'Remote' : 'Office',
          String(team.memberCount),
          team.totalCalls.toLocaleString(),
          team.interested.toLocaleString(),
          team.leadsGenerated.toLocaleString(),
          `${team.conversionRate}%`,
          String(team.avgCallsPerAgent),
        ];

        row.forEach((cell, i) => {
          doc.text(cell, xPos, yPos);
          xPos += colWidths[i];
        });

        yPos += 7;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text('Generated by Team Management System', pageWidth / 2, 285, { align: 'center' });

      doc.save(`team_performance_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with date filter and export */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold">Team Performance Comparison</h2>
          <p className="text-sm text-muted-foreground">Compare performance metrics across all teams</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Total Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last {days} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4" />
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalLeads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Generated by all teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Best Performing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{summary.bestTeam || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">Highest conversion rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{summary.worstTeam || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">Lowest conversion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart - Calls & Leads by Team */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls & Leads by Team</CardTitle>
            <CardDescription>Compare total activity across teams</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name === 'calls' ? 'Total Calls' : name === 'leads' ? 'Leads' : 'Interested']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Legend />
                <Bar dataKey="calls" name="Calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="interested" name="Interested" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leads" name="Leads" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Conversion Rate Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion Rate by Team</CardTitle>
            <CardDescription>Percentage of interested calls</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData} layout="vertical" margin={{ top: 20, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="name" type="category" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={80} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Conversion Rate']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar 
                  dataKey="conversion" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => `${v}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Radar Chart - Top Teams Comparison */}
        {topTeams.length > 1 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Top Teams Comparison</CardTitle>
              <CardDescription>Normalized performance across multiple metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  {topTeams.map((team, index) => (
                    <Radar
                      key={team.teamId}
                      name={team.teamName}
                      dataKey={team.teamName}
                      stroke={COLORS[index % COLORS.length]}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Pie Chart - Office vs Remote */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Office vs Remote</CardTitle>
            <CardDescription>Call distribution by team type</CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Calls']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Team Metrics</CardTitle>
          <CardDescription>Complete breakdown of all team performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Team</th>
                  <th className="text-left py-3 px-2 font-medium">Type</th>
                  <th className="text-right py-3 px-2 font-medium">Members</th>
                  <th className="text-right py-3 px-2 font-medium">Total Calls</th>
                  <th className="text-right py-3 px-2 font-medium">Interested</th>
                  <th className="text-right py-3 px-2 font-medium">Leads</th>
                  <th className="text-right py-3 px-2 font-medium">Conversion</th>
                  <th className="text-right py-3 px-2 font-medium">Avg/Agent</th>
                </tr>
              </thead>
              <tbody>
                {teamPerformance.map((team, index) => (
                  <tr key={team.teamId} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">
                      <div className="flex items-center gap-2">
                        {index === 0 && team.totalCalls > 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                        {team.teamName}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="text-xs">
                        {team.teamType === 'remote' ? (
                          <><Wifi className="w-3 h-3 mr-1" /> Remote</>
                        ) : (
                          <><Building2 className="w-3 h-3 mr-1" /> Office</>
                        )}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right">{team.memberCount}</td>
                    <td className="py-3 px-2 text-right font-medium">{team.totalCalls.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-green-600">{team.interested.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right text-amber-600">{team.leadsGenerated.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right">
                      <Badge variant={team.conversionRate >= 20 ? 'default' : team.conversionRate >= 10 ? 'secondary' : 'outline'}>
                        {team.conversionRate}%
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground">{team.avgCallsPerAgent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
