import { useMemo } from 'react';
import { Lead, LeadSource, LEAD_SOURCES } from '@/hooks/useLeads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Legend,
} from 'recharts';
import { TrendingUp, Target, DollarSign, Percent } from 'lucide-react';

interface LeadSourceAnalyticsProps {
  leads: Lead[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(221, 83%, 53%)',
  'hsl(262, 83%, 58%)',
  'hsl(25, 95%, 53%)',
  'hsl(47, 96%, 53%)',
  'hsl(346, 77%, 49%)',
  'hsl(199, 89%, 48%)',
];

export const LeadSourceAnalytics = ({ leads }: LeadSourceAnalyticsProps) => {
  const sourceStats = useMemo(() => {
    const stats = new Map<LeadSource, {
      total: number;
      converted: number;
      qualified: number;
      lost: number;
      totalDealValue: number;
      avgScore: number;
    }>();

    // Initialize all sources
    LEAD_SOURCES.forEach(source => {
      stats.set(source.value, {
        total: 0,
        converted: 0,
        qualified: 0,
        lost: 0,
        totalDealValue: 0,
        avgScore: 0,
      });
    });

    // Aggregate data
    leads.forEach(lead => {
      const current = stats.get(lead.leadSource) || {
        total: 0,
        converted: 0,
        qualified: 0,
        lost: 0,
        totalDealValue: 0,
        avgScore: 0,
      };

      current.total++;
      if (lead.leadStatus === 'converted') current.converted++;
      if (lead.leadStatus === 'qualified') current.qualified++;
      if (lead.leadStatus === 'lost') current.lost++;
      current.totalDealValue += lead.dealValue || 0;
      current.avgScore = ((current.avgScore * (current.total - 1)) + lead.leadScore) / current.total;

      stats.set(lead.leadSource, current);
    });

    return stats;
  }, [leads]);

  const chartData = useMemo(() => {
    return LEAD_SOURCES.map((source, index) => {
      const data = sourceStats.get(source.value);
      const conversionRate = data && data.total > 0 
        ? Math.round((data.converted / data.total) * 100) 
        : 0;

      return {
        name: source.label,
        icon: source.icon,
        total: data?.total || 0,
        converted: data?.converted || 0,
        qualified: data?.qualified || 0,
        lost: data?.lost || 0,
        dealValue: data?.totalDealValue || 0,
        avgScore: Math.round(data?.avgScore || 0),
        conversionRate,
        color: COLORS[index % COLORS.length],
      };
    }).filter(d => d.total > 0);
  }, [sourceStats]);

  const topSources = useMemo(() => {
    return [...chartData]
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5);
  }, [chartData]);

  const pieData = useMemo(() => {
    return chartData.map(d => ({
      name: d.name,
      value: d.total,
      color: d.color,
    }));
  }, [chartData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No lead source data</h3>
          <p className="text-muted-foreground mt-1">
            Start tracking lead sources to see analytics here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Performing Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Top Performing Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topSources.map((source, index) => (
              <div key={source.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{LEAD_SOURCES.find(s => s.label === source.name)?.icon}</span>
                    <span className="font-medium">{source.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {source.total} leads
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 font-medium">
                      {source.conversionRate}% conversion
                    </span>
                    <span className="text-muted-foreground">
                      {formatCurrency(source.dealValue)}
                    </span>
                  </div>
                </div>
                <Progress 
                  value={source.conversionRate} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lead Distribution by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Lead Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conversion Rate by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Conversion Rate']}
                  />
                  <Bar 
                    dataKey="conversionRate" 
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deal Value by Source */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Deal Value by Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Deal Value']}
                />
                <Bar 
                  dataKey="dealValue" 
                  fill="hsl(142, 76%, 36%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Source Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Detailed Source Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Source</th>
                  <th className="text-center py-2 font-medium">Total</th>
                  <th className="text-center py-2 font-medium">Qualified</th>
                  <th className="text-center py-2 font-medium">Converted</th>
                  <th className="text-center py-2 font-medium">Lost</th>
                  <th className="text-center py-2 font-medium">Conv. Rate</th>
                  <th className="text-center py-2 font-medium">Avg Score</th>
                  <th className="text-right py-2 font-medium">Deal Value</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(source => (
                  <tr key={source.name} className="border-b last:border-0">
                    <td className="py-2">
                      <span className="mr-2">{LEAD_SOURCES.find(s => s.label === source.name)?.icon}</span>
                      {source.name}
                    </td>
                    <td className="text-center py-2">{source.total}</td>
                    <td className="text-center py-2 text-purple-600">{source.qualified}</td>
                    <td className="text-center py-2 text-green-600">{source.converted}</td>
                    <td className="text-center py-2 text-red-600">{source.lost}</td>
                    <td className="text-center py-2">
                      <Badge variant={source.conversionRate >= 50 ? 'default' : 'secondary'}>
                        {source.conversionRate}%
                      </Badge>
                    </td>
                    <td className="text-center py-2">{source.avgScore}</td>
                    <td className="text-right py-2 font-medium">{formatCurrency(source.dealValue)}</td>
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

export default LeadSourceAnalytics;
