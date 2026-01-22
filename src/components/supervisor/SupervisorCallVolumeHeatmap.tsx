import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, getDay, getHours, format, startOfDay, endOfDay, startOfMonth, endOfMonth, isAfter, isBefore, isEqual } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarIcon, Users, FileDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface SupervisorCallVolumeHeatmapProps {
  teamId?: string;
}

interface HeatmapData {
  day: number;
  hour: number;
  value: number;
}

interface AgentOption {
  id: string;
  name: string;
}

type DateSelectionMode = 'single' | 'range';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

export const SupervisorCallVolumeHeatmap = ({ teamId }: SupervisorCallVolumeHeatmapProps) => {
  const { user, userRole, ledTeamId } = useAuth();
  
  // Date selection state
  const [dateSelectionMode, setDateSelectionMode] = useState<DateSelectionMode>('single');
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  
  // Popover state for controlling open/close
  const [singleDateOpen, setSingleDateOpen] = useState(false);
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);
  
  const canSeeAllData = ['admin', 'super_admin', 'operations_head'].includes(userRole || '');
  const effectiveTeamId = teamId || ledTeamId;

  // Validation: Ensure "To Date" is after "From Date"
  const isDateRangeValid = useMemo(() => {
    if (dateSelectionMode === 'single') return true;
    if (!fromDate || !toDate) return false;
    return isAfter(toDate, fromDate) || isEqual(toDate, fromDate);
  }, [dateSelectionMode, fromDate, toDate]);

  // Compute effective date range based on mode
  const effectiveDateRange = useMemo(() => {
    if (dateSelectionMode === 'single') {
      return { from: singleDate, to: singleDate };
    }
    return { from: fromDate, to: toDate };
  }, [dateSelectionMode, singleDate, fromDate, toDate]);

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

  const { data: heatmapData = [], isLoading, isFetching } = useQuery({
    queryKey: ['supervisor-call-heatmap', user?.id, effectiveTeamId, canSeeAllData, effectiveDateRange?.from?.toISOString(), effectiveDateRange?.to?.toISOString(), selectedAgentId],
    queryFn: async (): Promise<HeatmapData[]> => {
      if (!effectiveDateRange?.from || !effectiveDateRange?.to) return [];
      
      const startDate = startOfDay(effectiveDateRange.from);
      const endDate = endOfDay(effectiveDateRange.to);
      
      // Get agent IDs for filtering
      let agentIds: string[] | null = null;
      
      if (selectedAgentId !== 'all') {
        // Filter by specific agent
        agentIds = [selectedAgentId];
      } else if (!canSeeAllData && effectiveTeamId) {
        const { data: teamMembers } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', effectiveTeamId)
          .eq('is_active', true);
        agentIds = teamMembers?.map(p => p.id) || [];
      } else if (!canSeeAllData && user?.id) {
        // Supervisor without team - get directly supervised agents
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
    enabled: !!user?.id && isDateRangeValid,
  });

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

  // Calculate row totals (per day)
  const getDayTotal = (day: number) => {
    return hours.reduce((sum, hour) => sum + getValue(day, hour), 0);
  };

  // Calculate column totals (per hour)
  const getHourTotal = (hour: number) => {
    return days.reduce((sum, _, dayIndex) => sum + getValue(dayIndex, hour), 0);
  };

  // Calculate grand total
  const grandTotal = heatmapData.reduce((sum, d) => sum + d.value, 0);

  // Get selected agent name
  const getSelectedAgentName = () => {
    if (selectedAgentId === 'all') return 'All Agents';
    return agentOptions.find(a => a.id === selectedAgentId)?.name || 'Unknown Agent';
  };

  // Format date display
  const getDateDisplayText = () => {
    if (dateSelectionMode === 'single') {
      return format(singleDate, 'MMM d, yyyy');
    }
    if (fromDate && toDate) {
      return `${format(fromDate, 'MMM d, yyyy')} - ${format(toDate, 'MMM d, yyyy')}`;
    }
    return 'Select dates';
  };

  // PDF Export function
  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      // Helper function
      const addText = (text: string, x: number, y: number, options?: { fontSize?: number; fontStyle?: 'normal' | 'bold'; color?: [number, number, number] }) => {
        const { fontSize = 12, fontStyle = 'normal', color = [0, 0, 0] } = options || {};
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(...color);
        doc.text(text, x, y);
      };

      // Header
      addText('Call Volume Heatmap Report', margin, yPos, { fontSize: 20, fontStyle: 'bold', color: [41, 98, 255] });
      yPos += 12;

      // Report metadata
      addText(`Generated: ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}`, margin, yPos, { fontSize: 10, color: [100, 100, 100] });
      yPos += 6;
      addText(`Agent: ${getSelectedAgentName()}`, margin, yPos, { fontSize: 10, color: [100, 100, 100] });
      yPos += 6;
      addText(`Date Range: ${getDateDisplayText()}`, margin, yPos, { fontSize: 10, color: [100, 100, 100] });
      yPos += 12;

      // Summary card
      doc.setFillColor(248, 249, 250);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 3, 3, 'F');
      addText('Total Calls', margin + 8, yPos + 8, { fontSize: 10, color: [100, 100, 100] });
      addText(grandTotal.toString(), margin + 8, yPos + 16, { fontSize: 14, fontStyle: 'bold' });
      yPos += 30;

      // Heatmap table
      addText('Calls by Day and Hour', margin, yPos, { fontSize: 14, fontStyle: 'bold' });
      yPos += 10;

      // Table header
      const cellWidth = (pageWidth - margin * 2 - 35) / hours.length;
      const cellHeight = 8;
      
      // Hour labels
      doc.setFillColor(41, 98, 255);
      doc.rect(margin, yPos, pageWidth - margin * 2, cellHeight, 'F');
      addText('Day', margin + 2, yPos + 5.5, { fontSize: 7, fontStyle: 'bold', color: [255, 255, 255] });
      
      hours.forEach((hour, i) => {
        const x = margin + 25 + (i * cellWidth);
        addText(hour > 12 ? `${hour - 12}p` : `${hour}a`, x, yPos + 5.5, { fontSize: 6, fontStyle: 'bold', color: [255, 255, 255] });
      });
      addText('Total', margin + 25 + (hours.length * cellWidth), yPos + 5.5, { fontSize: 6, fontStyle: 'bold', color: [255, 255, 255] });
      yPos += cellHeight + 1;

      // Data rows
      days.forEach((dayName, dayIndex) => {
        // Alternating background
        if (dayIndex % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(margin, yPos, pageWidth - margin * 2, cellHeight, 'F');
        }
        
        addText(dayName, margin + 2, yPos + 5.5, { fontSize: 7, fontStyle: 'bold' });
        
        hours.forEach((hour, i) => {
          const value = getValue(dayIndex, hour);
          const x = margin + 25 + (i * cellWidth);
          if (value > 0) {
            addText(value.toString(), x, yPos + 5.5, { fontSize: 6 });
          }
        });
        
        const dayTotal = getDayTotal(dayIndex);
        addText(dayTotal.toString(), margin + 25 + (hours.length * cellWidth), yPos + 5.5, { fontSize: 6, fontStyle: 'bold' });
        yPos += cellHeight;
      });

      // Hour totals row
      yPos += 2;
      doc.setFillColor(220, 220, 220);
      doc.rect(margin, yPos, pageWidth - margin * 2, cellHeight, 'F');
      addText('Total', margin + 2, yPos + 5.5, { fontSize: 7, fontStyle: 'bold' });
      
      hours.forEach((hour, i) => {
        const hourTotal = getHourTotal(hour);
        const x = margin + 25 + (i * cellWidth);
        addText(hourTotal.toString(), x, yPos + 5.5, { fontSize: 6, fontStyle: 'bold' });
      });
      addText(grandTotal.toString(), margin + 25 + (hours.length * cellWidth), yPos + 5.5, { fontSize: 6, fontStyle: 'bold', color: [41, 98, 255] });

      // Footer
      yPos = doc.internal.pageSize.getHeight() - 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);
      addText('This report was automatically generated by the Sales Performance System.', margin, yPos, { fontSize: 8, color: [150, 150, 150] });

      // Save
      const dateStr = dateSelectionMode === 'single' 
        ? format(singleDate, 'yyyy-MM-dd')
        : `${format(fromDate!, 'yyyy-MM-dd')}_to_${format(toDate!, 'yyyy-MM-dd')}`;
      const agentStr = selectedAgentId === 'all' ? 'AllAgents' : getSelectedAgentName().replace(/\s+/g, '_');
      doc.save(`CallVolumeHeatmap_${agentStr}_${dateStr}.pdf`);
      
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  // Check if we have no data
  const hasNoData = !isLoading && heatmapData.length > 0 && grandTotal === 0;

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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-semibold">Call Volume Heatmap</CardTitle>
              <CardDescription>
                {getSelectedAgentName()} calls by day and hour • Total: {grandTotal}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPDF}
              disabled={grandTotal === 0}
              className="w-fit"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>

          {/* Date Selection Mode */}
          <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Selection Mode Toggle */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Date Selection</Label>
                <RadioGroup 
                  value={dateSelectionMode} 
                  onValueChange={(v) => setDateSelectionMode(v as DateSelectionMode)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single" className="text-sm cursor-pointer">Single Day</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="range" id="range" />
                    <Label htmlFor="range" className="text-sm cursor-pointer">Date Range</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Agent Selector */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">Agent Filter</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-[200px] h-9">
                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                    <SelectContent className="z-[200]">
                    <SelectItem value="all">All Agents</SelectItem>
                    {agentOptions.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="flex flex-wrap items-end gap-3">
              {dateSelectionMode === 'single' ? (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">Select Date</Label>
                  <Popover open={singleDateOpen} onOpenChange={setSingleDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal h-9",
                          !singleDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(singleDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[200]" align="start">
                      <Calendar
                        mode="single"
                        selected={singleDate}
                        onSelect={(date) => {
                          if (date) {
                            setSingleDate(date);
                            setSingleDateOpen(false);
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">From Date</Label>
                    <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[180px] justify-start text-left font-normal h-9",
                            !fromDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fromDate ? format(fromDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[200]" align="start">
                        <Calendar
                          mode="single"
                          selected={fromDate}
                          onSelect={(date) => {
                            if (!date) return;
                            setFromDate(date);
                            if (toDate && isBefore(toDate, date)) setToDate(date);
                            setFromDateOpen(false);
                          }}
                          disabled={(date) => date > new Date()}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-medium text-muted-foreground">To Date</Label>
                    <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[180px] justify-start text-left font-normal h-9",
                            !toDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {toDate ? format(toDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[200]" align="start">
                        <Calendar
                          mode="single"
                          selected={toDate}
                          onSelect={(date) => {
                            if (!date) return;
                            setToDate(date);
                            if (fromDate && isBefore(date, fromDate)) setFromDate(date);
                            setToDateOpen(false);
                          }}
                          disabled={(date) => date > new Date()}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        setFromDate(subDays(new Date(), 6));
                        setToDate(new Date());
                      }}
                    >
                      Last 7 Days
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        setFromDate(subDays(new Date(), 29));
                        setToDate(new Date());
                      }}
                    >
                      Last 30 Days
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        setFromDate(startOfMonth(new Date()));
                        setToDate(endOfMonth(new Date()));
                      }}
                    >
                      This Month
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Validation Error */}
            {!isDateRangeValid && dateSelectionMode === 'range' && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>"To Date" must be after or equal to "From Date"</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Loading indicator for fetching */}
        {isFetching && !isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Loading data...</span>
          </div>
        )}

        {/* No data message */}
        {hasNoData && !isFetching && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No data found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try selecting a different date range or agent filter
            </p>
          </div>
        )}

        {/* Heatmap Grid */}
        {!hasNoData && (
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
