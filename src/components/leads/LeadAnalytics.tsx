import { useMemo } from 'react';
import { Lead, LeadStatus } from '@/hooks/useLeads';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { 
  TrendingUp, 
  Target, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  Percent,
} from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval, parseISO } from 'date-fns';

interface LeadAnalyticsProps {
  leads: Lead[];
}

const STAGE_COLORS: Record<LeadStatus, string> = {
  new: '#3b82f6',
  contacted: '#eab308',
  qualified: '#a855f7',
  converted: '#f97316',
  approved: '#22c55e',
  lost: '#ef4444',
};

const STAGE_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'In Progress',
  qualified: 'Submitted',
  converted: 'Assessing',
  approved: 'Approved',
  lost: 'Lost',
};

export const LeadAnalytics = ({ leads }: LeadAnalyticsProps) => {
  // Pipeline funnel data (excludes Lost)
  const funnelData = useMemo(() => {
    const stages: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'approved'];
    return stages.map(status => ({
      stage: STAGE_LABELS[status],
      count: leads.filter(l => l.leadStatus === status).length,
      fill: STAGE_COLORS[status],
    }));
  }, [leads]);

  // Conversion rates between stages
  const conversionRates = useMemo(() => {
    const newCount = leads.filter(l => l.leadStatus === 'new').length;
    const contactedCount = leads.filter(l => l.leadStatus === 'contacted').length;
    const qualifiedCount = leads.filter(l => l.leadStatus === 'qualified').length;
    const convertedCount = leads.filter(l => l.leadStatus === 'converted').length;
    const approvedCount = leads.filter(l => l.leadStatus === 'approved').length;
    const lostCount = leads.filter(l => l.leadStatus === 'lost').length;
    
    const totalProcessed = contactedCount + qualifiedCount + convertedCount + approvedCount + lostCount;
    const totalCompleted = approvedCount + lostCount;
    
    return {
      contactRate: totalProcessed > 0 ? ((contactedCount + qualifiedCount + convertedCount + approvedCount) / (totalProcessed + newCount)) * 100 : 0,
      qualifyRate: totalProcessed > 0 ? ((qualifiedCount + convertedCount + approvedCount) / totalProcessed) * 100 : 0,
      approvalRate: totalCompleted > 0 ? (approvedCount / totalCompleted) * 100 : 0,
      lossRate: totalProcessed > 0 ? (lostCount / totalProcessed) * 100 : 0,
      overallConversion: leads.length > 0 ? (approvedCount / leads.length) * 100 : 0,
    };
  }, [leads]);

  // Deal values by stage
  const dealValuesByStage = useMemo(() => {
    const stages: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'approved'];
    return stages.map(status => ({
      stage: STAGE_LABELS[status],
      value: leads
        .filter(l => l.leadStatus === status)
        .reduce((sum, l) => sum + (l.dealValue || 0), 0),
      fill: STAGE_COLORS[status],
    }));
  }, [leads]);

  // Deal values over time (last 30 days) - tracks approved leads
  const dealValueTrend = useMemo(() => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = subDays(today, 30);
    
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const approvedOnDay = leads.filter(l => {
        if (l.leadStatus !== 'approved' || !l.qualifiedDate) return false;
        const qualifiedDay = format(parseISO(l.qualifiedDate), 'yyyy-MM-dd');
        return qualifiedDay === dayStr;
      });
      
      return {
        date: format(day, 'MMM d'),
        value: approvedOnDay.reduce((sum, l) => sum + (l.dealValue || 0), 0),
        count: approvedOnDay.length,
      };
    });
  }, [leads]);

  // Leads created over time (last 30 days)
  const leadsTrend = useMemo(() => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = subDays(today, 30);
    
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const createdOnDay = leads.filter(l => {
        if (!l.createdAt) return false;
        const createdDay = format(parseISO(l.createdAt), 'yyyy-MM-dd');
        return createdDay === dayStr;
      });
      
      return {
        date: format(day, 'MMM d'),
        new: createdOnDay.length,
        approved: leads.filter(l => {
          if (l.leadStatus !== 'approved' || !l.qualifiedDate) return false;
          const qualifiedDay = format(parseISO(l.qualifiedDate), 'yyyy-MM-dd');
          return qualifiedDay === dayStr;
        }).length,
      };
    });
  }, [leads]);

  // Pie chart data for status distribution
  const statusDistribution = useMemo(() => {
    const stages: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'approved', 'lost'];
    return stages.map(status => ({
      name: STAGE_LABELS[status],
      value: leads.filter(l => l.leadStatus === status).length,
      color: STAGE_COLORS[status],
    })).filter(d => d.value > 0);
  }, [leads]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  const totalPipeline = leads.reduce((sum, l) => sum + (l.dealValue || 0), 0);
  const approvedValue = leads
    .filter(l => l.leadStatus === 'approved')
    .reduce((sum, l) => sum + (l.dealValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Conversion</p>
                <p className="text-2xl font-bold">{conversionRates.overallConversion.toFixed(1)}%</p>
              </div>
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <p className="text-2xl font-bold">{conversionRates.approvalRate.toFixed(1)}%</p>
              </div>
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(approvedValue)}</p>
              </div>
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Loss Rate</p>
                <p className="text-2xl font-bold">{conversionRates.lossRate.toFixed(1)}%</p>
              </div>
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Funnel</CardTitle>
            <CardDescription>Leads at each stage of the sales process</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={80} />
                <Tooltip 
                  formatter={(value: number) => [value, 'Leads']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lead Distribution</CardTitle>
            <CardDescription>Current status breakdown of all leads</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deal Values by Stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deal Value by Stage</CardTitle>
            <CardDescription>Total potential revenue at each pipeline stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dealValuesByStage}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" />
                <YAxis tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Value']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {dealValuesByStage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Won Revenue Trend</CardTitle>
            <CardDescription>Converted deal values over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dealValueTrend}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }} 
                  interval="preserveStartEnd"
                />
                <YAxis tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#22c55e" 
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Leads Activity Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lead Activity Trend</CardTitle>
          <CardDescription>New leads vs conversions over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={leadsTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }} 
                interval="preserveStartEnd"
              />
              <YAxis />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))' 
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="new" 
                name="New Leads"
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="approved" 
                name="Approvals"
                stroke="#22c55e" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
