import { useMemo } from 'react';
import { Lead, LeadSource, LEAD_SOURCES, PRODUCT_TYPES, ACCOUNT_BANKS, parseLeadSource, ProductType, BankName } from '@/hooks/useLeads';
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
import { TrendingUp, Target, DollarSign, Percent, Building2, CreditCard } from 'lucide-react';

interface LeadSourceAnalyticsProps {
  leads: Lead[];
}

const PRODUCT_COLORS = {
  account: 'hsl(221, 83%, 53%)',
  loan: 'hsl(142, 76%, 36%)',
};

const BANK_COLORS: Record<string, string> = {
  RAK: 'hsl(var(--primary))',
  NBF: 'hsl(142, 76%, 36%)',
  UBL: 'hsl(221, 83%, 53%)',
  RUYA: 'hsl(262, 83%, 58%)',
  MASHREQ: 'hsl(25, 95%, 53%)',
  WIO: 'hsl(47, 96%, 53%)',
};

export const LeadSourceAnalytics = ({ leads }: LeadSourceAnalyticsProps) => {
  // Stats by product type
  const productStats = useMemo(() => {
    const stats: Record<ProductType, { total: number; converted: number; dealValue: number }> = {
      account: { total: 0, converted: 0, dealValue: 0 },
      loan: { total: 0, converted: 0, dealValue: 0 },
    };

    leads.forEach(lead => {
      const parsed = parseLeadSource(lead.leadSource);
      // Only process if parsed is valid AND the product type exists in our stats
      if (parsed && stats[parsed.product]) {
        stats[parsed.product].total++;
        if (lead.leadStatus === 'converted') stats[parsed.product].converted++;
        stats[parsed.product].dealValue += lead.dealValue || 0;
      }
    });

    return stats;
  }, [leads]);

  // Stats by bank
  const bankStats = useMemo(() => {
    const stats = new Map<BankName, { total: number; converted: number; dealValue: number; avgScore: number }>();

    leads.forEach(lead => {
      const parsed = parseLeadSource(lead.leadSource);
      if (parsed) {
        const current = stats.get(parsed.bank) || { total: 0, converted: 0, dealValue: 0, avgScore: 0 };
        current.total++;
        if (lead.leadStatus === 'converted') current.converted++;
        current.dealValue += lead.dealValue || 0;
        current.avgScore = ((current.avgScore * (current.total - 1)) + lead.leadScore) / current.total;
        stats.set(parsed.bank, current);
      }
    });

    return stats;
  }, [leads]);

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
    return LEAD_SOURCES.map((source) => {
      const data = sourceStats.get(source.value);
      const conversionRate = data && data.total > 0 
        ? Math.round((data.converted / data.total) * 100) 
        : 0;

      return {
        name: source.label,
        shortName: source.bank,
        icon: source.icon,
        product: source.product,
        bank: source.bank,
        total: data?.total || 0,
        converted: data?.converted || 0,
        qualified: data?.qualified || 0,
        lost: data?.lost || 0,
        dealValue: data?.totalDealValue || 0,
        avgScore: Math.round(data?.avgScore || 0),
        conversionRate,
        color: BANK_COLORS[source.bank] || 'hsl(var(--primary))',
      };
    }).filter(d => d.total > 0);
  }, [sourceStats]);

  const topSources = useMemo(() => {
    return [...chartData]
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 5);
  }, [chartData]);

  const productPieData = useMemo(() => {
    return Object.entries(productStats).map(([product, data]) => ({
      name: PRODUCT_TYPES.find(p => p.value === product)?.label || product,
      value: data.total,
      color: PRODUCT_COLORS[product as ProductType],
    })).filter(d => d.value > 0);
  }, [productStats]);

  const bankPieData = useMemo(() => {
    return Array.from(bankStats.entries()).map(([bank, data]) => ({
      name: ACCOUNT_BANKS.find(b => b.value === bank)?.label || bank,
      value: data.total,
      color: BANK_COLORS[bank] || 'hsl(var(--primary))',
    })).filter(d => d.value > 0);
  }, [bankStats]);

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

      {/* Product Type Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/20">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Account Leads</p>
                <p className="text-2xl font-bold">{productStats.account.total}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-600 font-medium">
                  {productStats.account.total > 0 
                    ? Math.round((productStats.account.converted / productStats.account.total) * 100)
                    : 0}% conv.
                </p>
                <p className="text-sm text-muted-foreground">{formatCurrency(productStats.account.dealValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <CreditCard className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Loan Leads</p>
                <p className="text-2xl font-bold">{productStats.loan.total}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-600 font-medium">
                  {productStats.loan.total > 0 
                    ? Math.round((productStats.loan.converted / productStats.loan.total) * 100)
                    : 0}% conv.
                </p>
                <p className="text-sm text-muted-foreground">{formatCurrency(productStats.loan.dealValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lead Distribution by Product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">By Product Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {productPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lead Distribution by Bank */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">By Bank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bankPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {bankPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate by Bank */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Conversion Rate by Product & Bank</CardTitle>
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
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value}%`, 'Conversion Rate']}
                />
                <Bar 
                  dataKey="conversionRate" 
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
          <CardTitle className="text-sm font-medium">Detailed Product & Bank Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Product</th>
                  <th className="text-left py-2 font-medium">Bank</th>
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
                      <Badge variant={source.product === 'account' ? 'default' : 'secondary'}>
                        {source.product === 'account' ? '🏦 Account' : '💰 Loan'}
                      </Badge>
                    </td>
                    <td className="py-2 font-medium">{source.bank}</td>
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
