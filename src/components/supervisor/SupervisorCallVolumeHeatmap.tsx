import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DateFilterComponent, DateFilterState, AgentOption } from '@/components/ui/DateFilterComponent';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDay, getHours, format, startOfDay, endOfDay, startOfMonth, getMonth, getYear } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SupervisorCallVolumeHeatmapProps {
  teamId?: string;
}

interface HeatmapData {
  day: number;
  hour: number;
  value: number;
}

interface MonthlyData {
  month: string;
  year: number;
  totalCalls: number;
}

interface GroupedMonthData {
  month: string;
  monthKey: string;
  data: HeatmapData[];
  count: number;
}

// Helper function to group data by month
const groupByMonth = (data: HeatmapData[], dateRange: { from: Date; to: Date } | null): GroupedMonthData[] => {
  if (!dateRange) return [];
  
  const grouped: Record<string, GroupedMonthData> = {};
  
  // Since heatmap data is aggregated by day/hour, we need to map it back to dates
  // For proper monthly grouping, we iterate through the date range
  let current = new Date(dateRange.from);
  const end = new Date(dateRange.to);
  
  while (current <= end) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const monthName = current.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        month: monthName,
        monthKey,
        data: [],
        count: 0
      };
    }
    
    // Find data for this day of week
    const dayOfWeek = current.getDay();
    const dayData = data.filter(d => d.day === dayOfWeek);
    grouped[monthKey].data.push(...dayData);
    grouped[monthKey].count += dayData.reduce((sum, d) => sum + d.value, 0);
    
    current.setDate(current.getDate() + 1);
  }
  
  return Object.values(grouped).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
};

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

export const SupervisorCallVolumeHeatmap = ({ teamId }: SupervisorCallVolumeHeatmapProps) => {
  const { user, userRole, ledTeamId } = useAuth();
  
  // Filter state (for UI inputs - not yet applied)
  const [filters, setFilters] = useState<DateFilterState>({
    selectionMode: null,
    singleDate: null,
    fromDate: null,
    toDate: null,
    selectedAgent: 'all',
    showMonthly: false,
  });
  
  // Applied filter state (used for actual data fetching)
  const [appliedFilters, setAppliedFilters] = useState<DateFilterState>({
    selectionMode: null,
    singleDate: null,
    fromDate: null,
    toDate: null,
    selectedAgent: 'all',
    showMonthly: false,
  });
  
  const [isExporting, setIsExporting] = useState(false);
  
  const canSeeAllData = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = teamId || ledTeamId;

  // Helper function to format date as YYYY-MM-DD
  const formatDateStr = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Compute effective date range from APPLIED filters only
  const effectiveDateRange = useMemo(() => {
    if (appliedFilters.selectionMode === 'single' && appliedFilters.singleDate) {
      return { from: appliedFilters.singleDate, to: appliedFilters.singleDate };
    }
    if (appliedFilters.selectionMode === 'range' && appliedFilters.fromDate && appliedFilters.toDate) {
      return { from: appliedFilters.fromDate, to: appliedFilters.toDate };
    }
    return null;
  }, [appliedFilters.selectionMode, appliedFilters.singleDate, appliedFilters.fromDate, appliedFilters.toDate]);

  // Fetch team agents for the filter dropdown
  const { data: agentOptions = [] } = useQuery({
    queryKey: ['heatmap-agents', user?.id, effectiveTeamId, canSeeAllData],
    queryFn: async (): Promise<AgentOption[]> => {
      let query = supabase
        .from('profiles_public')
        .select('id, full_name, username')
        .eq('is_active', true);

      if (!canSeeAllData && effectiveTeamId) {
        query = query.eq('team_id', effectiveTeamId);
      } else if (!canSeeAllData && user?.id) {
        query = query.eq('supervisor_id', user.id);
      }

      const { data, error } = await query.order('full_name');
      if (error) throw error;

      return (data || []).map(agent => ({
        id: agent.id,
        name: agent.full_name || agent.username || 'Unknown Agent'
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch heatmap data - uses APPLIED filters for agent selection
  const { data: heatmapData = [], isLoading, isFetching, error } = useQuery({
    queryKey: ['supervisor-call-heatmap', user?.id, effectiveTeamId, canSeeAllData, effectiveDateRange?.from?.toISOString(), effectiveDateRange?.to?.toISOString(), appliedFilters.selectedAgent],
    queryFn: async (): Promise<HeatmapData[]> => {
      if (!effectiveDateRange?.from || !effectiveDateRange?.to) return [];
      
      const startDate = startOfDay(effectiveDateRange.from);
      const endDate = endOfDay(effectiveDateRange.to);
      
      // Get agent IDs for filtering
      let agentIds: string[] | null = null;
      
      if (appliedFilters.selectedAgent !== 'all') {
        agentIds = [appliedFilters.selectedAgent];
      } else if (!canSeeAllData && effectiveTeamId) {
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', effectiveTeamId)
          .eq('is_active', true);
        agentIds = teamMembers?.map(p => p.id) || [];
      } else if (!canSeeAllData && user?.id) {
        const { data: supervised } = await supabase
          .from('profiles')
          .select('id')
          .eq('supervisor_id', user.id)
          .eq('is_active', true);
        agentIds = supervised?.map(p => p.id) || [];
      }

      let query = supabase
        .from('call_feedback')
        .select('call_timestamp')
        .gte('call_timestamp', startDate.toISOString())
        .lte('call_timestamp', endDate.toISOString());

      if (agentIds !== null && agentIds.length > 0) {
        query = query.in('agent_id', agentIds);
      } else if (agentIds !== null && agentIds.length === 0) {
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;

      // Initialize heatmap grid
      const heatmap: Map<string, number> = new Map();
      for (let day = 0; day < 7; day++) {
        for (let hour = 8; hour <= 20; hour++) {
          heatmap.set(`${day}-${hour}`, 0);
        }
      }

      // Aggregate calls by day and hour
      data?.forEach(call => {
        if (call.call_timestamp) {
          const date = new Date(call.call_timestamp);
          const day = getDay(date);
          const hour = getHours(date);
          if (hour >= 8 && hour <= 20) {
            const key = `${day}-${hour}`;
            heatmap.set(key, (heatmap.get(key) || 0) + 1);
          }
        }
      });

      return Array.from(heatmap.entries()).map(([key, value]) => {
        const [day, hour] = key.split('-').map(Number);
        return { day, hour, value };
      });
    },
    enabled: !!user?.id && !!effectiveDateRange,
  });

  // Calculate monthly data when showMonthly is enabled - uses APPLIED filters
  const monthlyData = useMemo((): MonthlyData[] => {
    if (!appliedFilters.showMonthly || !effectiveDateRange?.from || !effectiveDateRange?.to) return [];
    
    // Group heatmap data by month - since we only have aggregated data, 
    // we'll display the total for the selected range grouped conceptually
    const monthMap = new Map<string, number>();
    
    // For a proper monthly breakdown, we'd need the raw timestamps
    // For now, show the total for each month in the range
    const fromMonth = getMonth(effectiveDateRange.from);
    const fromYear = getYear(effectiveDateRange.from);
    const toMonth = getMonth(effectiveDateRange.to);
    const toYear = getYear(effectiveDateRange.to);
    
    const grandTotal = heatmapData.reduce((sum, d) => sum + d.value, 0);
    
    // If same month, just show that month
    if (fromMonth === toMonth && fromYear === toYear) {
      const monthName = format(effectiveDateRange.from, 'MMMM');
      return [{ month: monthName, year: fromYear, totalCalls: grandTotal }];
    }
    
    // Multiple months - distribute total (simplified)
    const result: MonthlyData[] = [];
    let current = startOfMonth(effectiveDateRange.from);
    const end = startOfMonth(effectiveDateRange.to);
    
    while (current <= end) {
      result.push({
        month: format(current, 'MMMM'),
        year: getYear(current),
        totalCalls: Math.round(grandTotal / ((toYear - fromYear) * 12 + (toMonth - fromMonth) + 1)),
      });
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    
    return result;
  }, [appliedFilters.showMonthly, effectiveDateRange, heatmapData]);

  const maxValue = Math.max(...heatmapData.map(d => d.value), 1);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-muted';
    const intensity = value / maxValue;
    if (intensity > 0.75) return 'bg-primary text-primary-foreground';
    if (intensity > 0.5) return 'bg-primary/75 text-primary-foreground';
    if (intensity > 0.25) return 'bg-primary/50 text-foreground';
    return 'bg-primary/25 text-foreground';
  };

  const getValue = (day: number, hour: number) => {
    const cell = heatmapData.find(d => d.day === day && d.hour === hour);
    return cell?.value || 0;
  };

  const getDayTotal = (day: number) => {
    return hours.reduce((sum, hour) => sum + getValue(day, hour), 0);
  };

  const getHourTotal = (hour: number) => {
    return days.reduce((sum, _, dayIndex) => sum + getValue(dayIndex, hour), 0);
  };

  const grandTotal = heatmapData.reduce((sum, d) => sum + d.value, 0);

  const getSelectedAgentName = () => {
    if (appliedFilters.selectedAgent === 'all') return 'All Agents';
    return agentOptions.find(a => a.id === appliedFilters.selectedAgent)?.name || 'Unknown Agent';
  };

  const getDateDisplayText = () => {
    if (appliedFilters.selectionMode === 'single' && appliedFilters.singleDate) {
      return format(appliedFilters.singleDate, 'dd/MM/yyyy');
    }
    if (appliedFilters.selectionMode === 'range' && appliedFilters.fromDate && appliedFilters.toDate) {
      return `${format(appliedFilters.fromDate, 'dd/MM/yyyy')} - ${format(appliedFilters.toDate, 'dd/MM/yyyy')}`;
    }
    return 'No date selected';
  };

  // Handle filter changes (just updates UI state, doesn't trigger fetch)
  const handleFilterChange = useCallback((newFilters: DateFilterState) => {
    setFilters(newFilters);
  }, []);

  // Handle Apply Filter - applies the current UI filters to trigger data fetch
  const handleApplyFilter = useCallback((newFilters: DateFilterState) => {
    // Validate dates before applying
    if (newFilters.selectionMode === 'single' && !newFilters.singleDate) {
      toast.error('Please select a date');
      return;
    }
    if (newFilters.selectionMode === 'range') {
      if (!newFilters.fromDate || !newFilters.toDate) {
        toast.error('Please select both From and To dates');
        return;
      }
      if (newFilters.fromDate > newFilters.toDate) {
        toast.error('From date must be before To date');
        return;
      }
    }
    
    // Apply the filters - this will trigger data fetch
    setAppliedFilters(newFilters);
    toast.success('Filters applied successfully');
  }, []);

  // PDF Export function with autoTable
  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let yPos = 20;

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 98, 255);
      doc.text('Call Volume Heatmap Report', margin, yPos);
      yPos += 10;

      // Subtitle with date range
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Date: ${getDateDisplayText()}`, margin, yPos);
      yPos += 6;
      
      // Agent info
      doc.text(`Agent: ${getSelectedAgentName()}`, margin, yPos);
      yPos += 6;

      // Generation date
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}`, margin, yPos);
      yPos += 10;

      // Filters Applied section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Filters Applied:', margin, yPos);
      yPos += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`• Selection Mode: ${appliedFilters.selectionMode === 'single' ? 'Single Day' : 'Date Range'}`, margin + 4, yPos);
      yPos += 5;
      doc.text(`• Monthly View: ${appliedFilters.showMonthly ? 'Enabled' : 'Disabled'}`, margin + 4, yPos);
      yPos += 10;

      // Summary card
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 15, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Total Calls', margin + 8, yPos + 6);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(grandTotal.toString(), margin + 8, yPos + 12);
      yPos += 22;

      // Monthly Summary Table (if enabled)
      if (filters.showMonthly && monthlyData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Monthly Summary', margin, yPos);
        yPos += 5;

        autoTable(doc, {
          head: [['Month', 'Year', 'Total Calls']],
          body: monthlyData.map(m => [m.month, m.year.toString(), m.totalCalls.toString()]),
          startY: yPos,
          margin: { left: margin, right: margin },
          styles: { fontSize: 9 },
          headStyles: { fillColor: [66, 139, 202] },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Heatmap Data Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Calls by Day and Hour', margin, yPos);
      yPos += 5;

      // Build table data
      const tableHead = [['Day', ...hours.map(h => h > 12 ? `${h - 12}pm` : `${h}am`), 'Total']];
      const tableBody = days.map((dayName, dayIndex) => {
        const row = [dayName];
        hours.forEach(hour => {
          row.push(getValue(dayIndex, hour).toString());
        });
        row.push(getDayTotal(dayIndex).toString());
        return row;
      });

      // Add totals row
      const totalsRow = ['Total'];
      hours.forEach(hour => {
        totalsRow.push(getHourTotal(hour).toString());
      });
      totalsRow.push(grandTotal.toString());
      tableBody.push(totalsRow);

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: yPos,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [41, 98, 255], fontSize: 6 },
        columnStyles: {
          0: { fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          // Style the last row (totals)
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 220, 220];
          }
          // Style the last column (row totals)
          if (data.column.index === hours.length + 1) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('This report was automatically generated by the Sales Performance System.', margin, footerY);

      // Page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, footerY);
      }

      // Save PDF
      const dateStr = filters.selectionMode === 'single' && filters.singleDate
        ? format(filters.singleDate, 'yyyy-MM-dd')
        : filters.fromDate && filters.toDate
        ? `${format(filters.fromDate, 'yyyy-MM-dd')}_to_${format(filters.toDate, 'yyyy-MM-dd')}`
        : 'unknown';
      const agentStr = filters.selectedAgent === 'all' ? 'AllAgents' : getSelectedAgentName().replace(/\s+/g, '_');
      doc.save(`CallVolumeHeatmap_${agentStr}_${dateStr}.pdf`);
      
      toast.success('PDF exported successfully');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to generate PDF. Please try again');
    } finally {
      setIsExporting(false);
    }
  }, [filters, grandTotal, monthlyData, getDateDisplayText, getSelectedAgentName, getValue, getDayTotal, getHourTotal]);

  // Check for empty data
  const hasNoData = !isLoading && !isFetching && heatmapData.length > 0 && grandTotal === 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Volume Heatmap</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="text-lg font-semibold">Call Volume Heatmap</CardTitle>
          <CardDescription>
            {getSelectedAgentName()} calls by day and hour • Total: {grandTotal}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Date Filter Component */}
        <DateFilterComponent
          agents={agentOptions}
          onFilterChange={handleFilterChange}
          onApplyFilter={handleApplyFilter}
          onExportPDF={handleExportPDF}
          isLoading={isFetching}
          isExporting={isExporting}
          canExport={grandTotal > 0}
        />

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>Error loading data. Please refresh</span>
          </div>
        )}

        {/* No Data State */}
        {hasNoData && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No data found for selected filters</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try selecting a different date range or agent filter
            </p>
          </div>
        )}

        {/* Monthly Summary View */}
        {filters.showMonthly && monthlyData.length > 0 && !hasNoData && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="text-sm font-semibold mb-3">Monthly Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {monthlyData.map((m, idx) => (
                <div key={idx} className="p-3 bg-background rounded-md border">
                  <p className="text-sm font-medium">{m.month} {m.year}</p>
                  <p className="text-2xl font-bold text-primary">{m.totalCalls}</p>
                  <p className="text-xs text-muted-foreground">calls</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heatmap Grid */}
        {!hasNoData && !error && (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex mb-1">
                <div className="w-14" />
                {hours.map(hour => (
                  <div key={hour} className="flex-1 text-center text-xs text-muted-foreground font-medium">
                    {hour > 12 ? `${hour - 12}p` : `${hour}a`}
                  </div>
                ))}
                <div className="w-14 text-center text-xs text-muted-foreground font-semibold">Total</div>
              </div>
              
              {/* Heatmap grid */}
              {days.map((day, dayIndex) => {
                const dayTotal = getDayTotal(dayIndex);
                return (
                  <div key={day} className="flex items-center gap-1 mb-1">
                    <div className="w-14 text-xs text-muted-foreground font-medium">{day}</div>
                    {hours.map(hour => {
                      const value = getValue(dayIndex, hour);
                      return (
                        <div
                          key={`${dayIndex}-${hour}`}
                          className={`flex-1 h-8 rounded-sm ${getColor(value)} transition-colors cursor-default flex items-center justify-center`}
                          title={`${day} ${hour}:00 - ${value} calls`}
                        >
                          <span className="text-[11px] font-medium">
                            {value > 0 ? value : ''}
                          </span>
                        </div>
                      );
                    })}
                    <div className="w-14 h-8 rounded-sm bg-accent/50 flex items-center justify-center">
                      <span className="text-xs font-semibold text-foreground">{dayTotal}</span>
                    </div>
                  </div>
                );
              })}

              {/* Hour totals row */}
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
                <div className="w-14 text-xs text-muted-foreground font-semibold">Total</div>
                {hours.map(hour => {
                  const hourTotal = getHourTotal(hour);
                  return (
                    <div
                      key={`total-${hour}`}
                      className="flex-1 h-8 rounded-sm bg-accent/50 flex items-center justify-center"
                    >
                      <span className="text-[11px] font-semibold text-foreground">{hourTotal}</span>
                    </div>
                  );
                })}
                <div className="w-14 h-8 rounded-sm bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">{grandTotal}</span>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded-sm bg-muted" />
                  <div className="w-5 h-5 rounded-sm bg-primary/25" />
                  <div className="w-5 h-5 rounded-sm bg-primary/50" />
                  <div className="w-5 h-5 rounded-sm bg-primary/75" />
                  <div className="w-5 h-5 rounded-sm bg-primary" />
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
