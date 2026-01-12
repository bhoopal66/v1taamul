import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Download, FileSpreadsheet, CalendarIcon, Filter, Building2, MapPin, Users, User, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ACCOUNT_BANKS, LOAN_BANKS, PRODUCT_TYPES, parseLeadSource } from '@/hooks/useLeads';

interface ApprovedLead {
  id: string;
  companyName: string;
  contactPerson: string;
  phoneNumber: string;
  tradeLicense: string;
  city: string | null;
  area: string | null;
  industry: string | null;
  leadSource: string;
  productType: string;
  bankName: string;
  dealValue: number | null;
  approvedAt: string;
  agentName: string;
  teamName: string | null;
  notes: string | null;
}

// All banks combined
const ALL_BANKS = [...new Map([...ACCOUNT_BANKS, ...LOAN_BANKS].map(b => [b.value, b])).values()];

export const ApprovedLeadsExport: React.FC = () => {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 1)));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch teams for filter
  const { data: teams } = useQuery({
    queryKey: ['teams-for-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch agents for filter
  const { data: agents } = useQuery({
    queryKey: ['agents-for-export', teamFilter],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, team_id')
        .eq('is_active', true)
        .order('full_name');

      if (teamFilter !== 'all') {
        query = query.eq('team_id', teamFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch approved leads with filters
  const { data: approvedLeads, isLoading, refetch } = useQuery({
    queryKey: ['approved-leads-export', dateFrom, dateTo, bankFilter, productTypeFilter, teamFilter, agentFilter, cityFilter],
    queryFn: async (): Promise<ApprovedLead[]> => {
      // Fetch leads with status 'approved'
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          lead_source,
          deal_value,
          updated_at,
          notes,
          agent_id,
          master_contacts (
            company_name,
            contact_person_name,
            phone_number,
            trade_license_number,
            city,
            area,
            industry
          )
        `)
        .eq('lead_status', 'approved')
        .gte('updated_at', dateFrom.toISOString())
        .lte('updated_at', dateTo.toISOString())
        .order('updated_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch profiles with team info
      const agentIds = [...new Set((leadsData || []).map(l => l.agent_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, username, team_id')
        .in('id', agentIds);

      // Fetch team names
      const teamIds = [...new Set((profilesData || []).map(p => p.team_id).filter(Boolean))];
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      const teamsMap = new Map((teamsData || []).map(t => [t.id, t.name]));

      let leads = (leadsData || []).map(lead => {
        const profile = profilesMap.get(lead.agent_id);
        const parsed = parseLeadSource(lead.lead_source);
        return {
          id: lead.id,
          companyName: lead.master_contacts?.company_name || 'Unknown',
          contactPerson: lead.master_contacts?.contact_person_name || 'Unknown',
          phoneNumber: lead.master_contacts?.phone_number || '',
          tradeLicense: lead.master_contacts?.trade_license_number || '',
          city: lead.master_contacts?.city || null,
          area: lead.master_contacts?.area || null,
          industry: lead.master_contacts?.industry || null,
          leadSource: lead.lead_source || '',
          productType: parsed?.product || 'account',
          bankName: parsed?.bank || 'Unknown',
          dealValue: lead.deal_value,
          approvedAt: lead.updated_at || '',
          agentName: profile?.full_name || profile?.username || 'Unknown',
          teamName: profile?.team_id ? teamsMap.get(profile.team_id) || null : null,
          notes: lead.notes,
          agentId: lead.agent_id,
          teamId: profile?.team_id || null,
        };
      });

      // Apply filters
      if (bankFilter !== 'all') {
        leads = leads.filter(l => l.bankName === bankFilter);
      }
      if (productTypeFilter !== 'all') {
        leads = leads.filter(l => l.productType === productTypeFilter);
      }
      if (teamFilter !== 'all') {
        leads = leads.filter(l => (l as any).teamId === teamFilter);
      }
      if (agentFilter !== 'all') {
        leads = leads.filter(l => (l as any).agentId === agentFilter);
      }
      if (cityFilter !== 'all') {
        leads = leads.filter(l => l.city === cityFilter);
      }

      return leads;
    },
  });

  // Get unique cities from leads for filter
  const uniqueCities = [...new Set((approvedLeads || []).map(l => l.city).filter(Boolean))] as string[];

  // Calculate bank-wise summary breakdown
  const bankSummary = React.useMemo(() => {
    if (!approvedLeads || approvedLeads.length === 0) return [];
    
    const summaryMap = new Map<string, { count: number; dealValue: number }>();
    
    approvedLeads.forEach(lead => {
      const bank = lead.bankName;
      const existing = summaryMap.get(bank) || { count: 0, dealValue: 0 };
      summaryMap.set(bank, {
        count: existing.count + 1,
        dealValue: existing.dealValue + (lead.dealValue || 0),
      });
    });
    
    return Array.from(summaryMap.entries())
      .map(([bank, data]) => ({
        bank,
        count: data.count,
        dealValue: data.dealValue,
        percentage: ((data.count / approvedLeads.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);
  }, [approvedLeads]);

  // Calculate agent-wise summary breakdown
  const agentSummary = React.useMemo(() => {
    if (!approvedLeads || approvedLeads.length === 0) return [];
    
    const summaryMap = new Map<string, { count: number; dealValue: number }>();
    
    approvedLeads.forEach(lead => {
      const agent = lead.agentName;
      const existing = summaryMap.get(agent) || { count: 0, dealValue: 0 };
      summaryMap.set(agent, {
        count: existing.count + 1,
        dealValue: existing.dealValue + (lead.dealValue || 0),
      });
    });
    
    return Array.from(summaryMap.entries())
      .map(([agent, data]) => ({
        agent,
        count: data.count,
        dealValue: data.dealValue,
        percentage: ((data.count / approvedLeads.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);
  }, [approvedLeads]);

  // Calculate team-wise summary breakdown
  const teamSummary = React.useMemo(() => {
    if (!approvedLeads || approvedLeads.length === 0) return [];
    
    const summaryMap = new Map<string, { count: number; dealValue: number }>();
    
    approvedLeads.forEach(lead => {
      const team = lead.teamName || 'Unassigned';
      const existing = summaryMap.get(team) || { count: 0, dealValue: 0 };
      summaryMap.set(team, {
        count: existing.count + 1,
        dealValue: existing.dealValue + (lead.dealValue || 0),
      });
    });
    
    return Array.from(summaryMap.entries())
      .map(([team, data]) => ({
        team,
        count: data.count,
        dealValue: data.dealValue,
        percentage: ((data.count / approvedLeads.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);
  }, [approvedLeads]);

  const exportToExcel = () => {
    if (!approvedLeads || approvedLeads.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const exportData = approvedLeads.map((lead, index) => ({
        '#': index + 1,
        'Company Name': lead.companyName,
        'Contact Person': lead.contactPerson,
        'Phone Number': lead.phoneNumber,
        'Trade License': lead.tradeLicense,
        'City': lead.city || '-',
        'Area': lead.area || '-',
        'Industry': lead.industry || '-',
        'Product Type': lead.productType.charAt(0).toUpperCase() + lead.productType.slice(1),
        'Bank': lead.bankName,
        'Deal Value': lead.dealValue || 0,
        'Approved Date': format(new Date(lead.approvedAt), 'yyyy-MM-dd HH:mm'),
        'Agent Name': lead.agentName,
        'Team': lead.teamName || '-',
        'Notes': lead.notes || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 4 },   // #
        { wch: 30 },  // Company Name
        { wch: 25 },  // Contact Person
        { wch: 15 },  // Phone Number
        { wch: 20 },  // Trade License
        { wch: 15 },  // City
        { wch: 15 },  // Area
        { wch: 20 },  // Industry
        { wch: 12 },  // Product Type
        { wch: 12 },  // Bank
        { wch: 12 },  // Deal Value
        { wch: 18 },  // Approved Date
        { wch: 25 },  // Agent Name
        { wch: 20 },  // Team
        { wch: 40 },  // Notes
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Leads');

      // Add bank summary sheet
      if (bankSummary.length > 0) {
        const summaryData = [
          ...bankSummary.map(item => ({
            'Bank': item.bank,
            'Count': item.count,
            'Deal Value': item.dealValue,
            'Percentage': `${item.percentage}%`,
          })),
          {
            'Bank': 'TOTAL',
            'Count': approvedLeads.length,
            'Deal Value': totalDealValue,
            'Percentage': '100%',
          }
        ];
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        summarySheet['!cols'] = [
          { wch: 15 },  // Bank
          { wch: 10 },  // Count
          { wch: 15 },  // Deal Value
          { wch: 12 },  // Percentage
        ];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Bank Summary');
      }

      // Add team summary sheet
      if (teamSummary.length > 0) {
        const teamData = [
          ...teamSummary.map(item => ({
            'Team': item.team,
            'Count': item.count,
            'Deal Value': item.dealValue,
            'Percentage': `${item.percentage}%`,
          })),
          {
            'Team': 'TOTAL',
            'Count': approvedLeads.length,
            'Deal Value': totalDealValue,
            'Percentage': '100%',
          }
        ];
        const teamSheet = XLSX.utils.json_to_sheet(teamData);
        teamSheet['!cols'] = [
          { wch: 25 },  // Team
          { wch: 10 },  // Count
          { wch: 15 },  // Deal Value
          { wch: 12 },  // Percentage
        ];
        XLSX.utils.book_append_sheet(workbook, teamSheet, 'Team Summary');
      }

      // Add agent summary sheet
      if (agentSummary.length > 0) {
        const agentData = [
          ...agentSummary.map(item => ({
            'Agent': item.agent,
            'Count': item.count,
            'Deal Value': item.dealValue,
            'Percentage': `${item.percentage}%`,
          })),
          {
            'Agent': 'TOTAL',
            'Count': approvedLeads.length,
            'Deal Value': totalDealValue,
            'Percentage': '100%',
          }
        ];
        const agentSheet = XLSX.utils.json_to_sheet(agentData);
        agentSheet['!cols'] = [
          { wch: 25 },  // Agent
          { wch: 10 },  // Count
          { wch: 15 },  // Deal Value
          { wch: 12 },  // Percentage
        ];
        XLSX.utils.book_append_sheet(workbook, agentSheet, 'Agent Summary');
      }

      // Generate filename with filters
      const filterParts = [];
      if (productTypeFilter !== 'all') filterParts.push(productTypeFilter);
      if (bankFilter !== 'all') filterParts.push(bankFilter);
      if (teamFilter !== 'all') {
        const team = teams?.find(t => t.id === teamFilter);
        if (team) filterParts.push(team.name.replace(/\s+/g, '_'));
      }
      if (agentFilter !== 'all') {
        const agent = agents?.find(a => a.id === agentFilter);
        if (agent) filterParts.push((agent.full_name || agent.username).replace(/\s+/g, '_'));
      }
      if (cityFilter !== 'all') filterParts.push(cityFilter.replace(/\s+/g, '_'));

      const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';
      const filename = `approved_leads_${format(dateFrom, 'yyyy-MM-dd')}_to_${format(dateTo, 'yyyy-MM-dd')}${filterSuffix}.xlsx`;

      XLSX.writeFile(workbook, filename);
      toast.success(`Exported ${approvedLeads.length} approved leads`);
    } catch (error) {
      toast.error('Failed to export data');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = () => {
    if (!approvedLeads || approvedLeads.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const headers = [
        '#', 'Company Name', 'Contact Person', 'Phone Number', 'Trade License',
        'City', 'Area', 'Industry', 'Product Type', 'Bank', 'Deal Value',
        'Approved Date', 'Agent Name', 'Team', 'Notes'
      ];

      const csvContent = [
        headers.join(','),
        ...approvedLeads.map((lead, index) => {
          const values = [
            index + 1,
            `"${(lead.companyName || '').replace(/"/g, '""')}"`,
            `"${(lead.contactPerson || '').replace(/"/g, '""')}"`,
            lead.phoneNumber,
            lead.tradeLicense,
            lead.city || '-',
            lead.area || '-',
            `"${(lead.industry || '-').replace(/"/g, '""')}"`,
            lead.productType.charAt(0).toUpperCase() + lead.productType.slice(1),
            lead.bankName,
            lead.dealValue || 0,
            format(new Date(lead.approvedAt), 'yyyy-MM-dd HH:mm'),
            `"${(lead.agentName || '').replace(/"/g, '""')}"`,
            lead.teamName || '-',
            `"${(lead.notes || '-').replace(/"/g, '""')}"`,
          ];
          return values.join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const filterParts = [];
      if (productTypeFilter !== 'all') filterParts.push(productTypeFilter);
      if (bankFilter !== 'all') filterParts.push(bankFilter);
      if (teamFilter !== 'all') {
        const team = teams?.find(t => t.id === teamFilter);
        if (team) filterParts.push(team.name.replace(/\s+/g, '_'));
      }
      const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';
      const filename = `approved_leads_${format(dateFrom, 'yyyy-MM-dd')}_to_${format(dateTo, 'yyyy-MM-dd')}${filterSuffix}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${approvedLeads.length} approved leads`);
    } catch (error) {
      toast.error('Failed to export data');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const totalDealValue = (approvedLeads || []).reduce((sum, l) => sum + (l.dealValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Export Filters
          </CardTitle>
          <CardDescription>
            Filter approved leads by date, bank, team, location, and agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date From */}
            <div className="space-y-2">
              <Label>Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label>Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Product Type Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Product Type
              </Label>
              <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {PRODUCT_TYPES.map(product => (
                    <SelectItem key={product.value} value={product.value}>
                      {product.icon} {product.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bank Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Bank
              </Label>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Banks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
                  {ALL_BANKS.map(bank => (
                    <SelectItem key={bank.value} value={bank.value}>
                      {bank.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team
              </Label>
              <Select value={teamFilter} onValueChange={(value) => {
                setTeamFilter(value);
                setAgentFilter('all'); // Reset agent when team changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams?.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agent Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Agent
              </Label>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents?.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name || agent.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City/Location Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                City
              </Label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {uniqueCities.map(city => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
            <Button 
              onClick={exportToExcel} 
              disabled={isExporting || isLoading || !approvedLeads?.length}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export to Excel
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToCSV} 
              disabled={isExporting || isLoading || !approvedLeads?.length}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{approvedLeads?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {totalDealValue.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Total Deal Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {[...new Set((approvedLeads || []).map(l => l.bankName))].length}
            </div>
            <p className="text-sm text-muted-foreground">Banks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {[...new Set((approvedLeads || []).map(l => l.agentName))].length}
            </div>
            <p className="text-sm text-muted-foreground">Agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank-wise Summary Breakdown */}
      {bankSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bank-wise Summary
            </CardTitle>
            <CardDescription>
              Breakdown by bank showing count and deal value totals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankSummary.map((item) => (
                <div
                  key={item.bank}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="font-semibold">
                      {item.bank}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Count:</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Deal Value:</span>
                      <span className="font-medium text-green-600">
                        {item.dealValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Summary Table */}
            <div className="mt-6 pt-4 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Deal Value</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankSummary.map((item) => (
                    <TableRow key={item.bank}>
                      <TableCell className="font-medium">{item.bank}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {item.dealValue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{item.percentage}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{approvedLeads?.length || 0}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {totalDealValue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team-wise Summary Breakdown */}
      {teamSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team-wise Summary
            </CardTitle>
            <CardDescription>
              Breakdown by team showing count and deal value totals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamSummary.map((item) => (
                <div
                  key={item.team}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="font-semibold">
                      {item.team}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Count:</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Deal Value:</span>
                      <span className="font-medium text-green-600">
                        {item.dealValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Deal Value</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamSummary.map((item) => (
                    <TableRow key={item.team}>
                      <TableCell className="font-medium">{item.team}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {item.dealValue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{item.percentage}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{approvedLeads?.length || 0}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {totalDealValue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent-wise Summary Breakdown */}
      {agentSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Agent-wise Summary
            </CardTitle>
            <CardDescription>
              Breakdown by agent showing count and deal value totals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentSummary.slice(0, 12).map((item) => (
                <div
                  key={item.agent}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className="font-semibold bg-primary/10 text-primary hover:bg-primary/20">
                      {item.agent}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Count:</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Deal Value:</span>
                      <span className="font-medium text-green-600">
                        {item.dealValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {agentSummary.length > 12 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Showing top 12 agents. See table below for complete list.
              </p>
            )}
            
            <div className="mt-6 pt-4 border-t">
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Deal Value</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentSummary.map((item) => (
                      <TableRow key={item.agent}>
                        <TableCell className="font-medium">{item.agent}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {item.dealValue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{item.percentage}%</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{approvedLeads?.length || 0}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {totalDealValue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle>Preview ({approvedLeads?.length || 0} leads)</CardTitle>
          <CardDescription>
            Showing approved leads from {format(dateFrom, 'PP')} to {format(dateTo, 'PP')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !approvedLeads?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No approved leads found for the selected filters
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Approved Date</TableHead>
                    <TableHead className="text-right">Deal Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedLeads.slice(0, 50).map((lead, index) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lead.companyName}</p>
                          <p className="text-xs text-muted-foreground">{lead.contactPerson}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.bankName}</Badge>
                      </TableCell>
                      <TableCell>{lead.city || '-'}</TableCell>
                      <TableCell>{lead.agentName}</TableCell>
                      <TableCell>{lead.teamName || '-'}</TableCell>
                      <TableCell>{format(new Date(lead.approvedAt), 'PP')}</TableCell>
                      <TableCell className="text-right">
                        {lead.dealValue ? lead.dealValue.toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {approvedLeads.length > 50 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Showing first 50 of {approvedLeads.length} leads. Export to see all.
                </p>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
