import { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FileDown, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AgentOption {
  id: string;
  name: string;
}

export interface DateFilterState {
  selectionMode: 'single' | 'range' | null;
  singleDate: Date | null;
  fromDate: Date | null;
  toDate: Date | null;
  selectedAgent: string;
  showMonthly: boolean;
}

interface DateFilterComponentProps {
  agents: AgentOption[];
  onFilterChange: (filters: DateFilterState) => void;
  onApplyFilter: (filters: DateFilterState) => void;
  onExportPDF: () => void;
  isLoading?: boolean;
  isExporting?: boolean;
  canExport?: boolean;
  className?: string;
}

export const DateFilterComponent = ({
  agents,
  onFilterChange,
  onApplyFilter,
  onExportPDF,
  isLoading = false,
  isExporting = false,
  canExport = true,
  className,
}: DateFilterComponentProps) => {
  // State management
  const [selectionMode, setSelectionMode] = useState<'single' | 'range' | null>(null);
  const [singleDate, setSingleDate] = useState<Date | null>(null);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string | null>(null);

  // Validation function - checks if dates are valid for current mode
  const isDateValid = (): boolean => {
    if (selectionMode === 'single') {
      return singleDate !== null;
    }
    if (selectionMode === 'range') {
      return fromDate !== null && toDate !== null && fromDate <= toDate;
    }
    return false;
  };

  // Date range validation (for UI state)
  const isDateRangeValid = useMemo(() => {
    return isDateValid();
  }, [selectionMode, singleDate, fromDate, toDate]);

  // Handle Apply Filter
  const handleApplyFilter = () => {
    if (isDateValid()) {
      onApplyFilter({
        selectionMode,
        singleDate,
        fromDate,
        toDate,
        selectedAgent,
        showMonthly,
      });
    }
  };

  // Validate and update error state
  useEffect(() => {
    if (selectionMode === 'range' && fromDate && toDate) {
      if (toDate < fromDate) {
        setDateError('End date must be after start date');
      } else {
        setDateError(null);
      }
    } else {
      setDateError(null);
    }
  }, [selectionMode, fromDate, toDate]);

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange({
      selectionMode,
      singleDate,
      fromDate,
      toDate,
      selectedAgent,
      showMonthly,
    });
  }, [selectionMode, singleDate, fromDate, toDate, selectedAgent, showMonthly, onFilterChange]);

  // Handle mode switch - clear appropriate dates when switching
  const handleModeChange = (mode: 'single' | 'range') => {
    setSelectionMode(mode);
    if (mode === 'single') {
      setFromDate(null);  // Clear range dates when switching
      setToDate(null);
    } else {
      setSingleDate(null);  // Clear single date when switching
    }
    setDateError(null);
  };

  // Handle From Date change
  const handleFromDateChange = (date: Date | null) => {
    setFromDate(date);
    // Auto-clear To Date if it's before the new From Date
    if (date && toDate && toDate < date) {
      setToDate(null);
    }
  };

  // Handle To Date change
  const handleToDateChange = (date: Date | null) => {
    setToDate(date);
  };

  return (
    <div className={cn("flex flex-col gap-4 p-4 bg-card border rounded-lg", className)}>
      {/* Row 1: Mode Toggle + Agent Filter */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Selection Mode Toggle - Radio Buttons */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium text-muted-foreground">Date Selection Mode</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateMode"
                value="single"
                checked={selectionMode === 'single'}
                onChange={() => handleModeChange('single')}
                className="h-4 w-4 text-primary border-input focus:ring-ring focus:ring-2 accent-primary"
              />
              <span className="text-sm">Pick a Single Day</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateMode"
                value="range"
                checked={selectionMode === 'range'}
                onChange={() => handleModeChange('range')}
                className="h-4 w-4 text-primary border-input focus:ring-ring focus:ring-2 accent-primary"
              />
              <span className="text-sm">Select Date Range (From - To)</span>
            </label>
          </div>
        </div>

        {/* Agent Filter */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium text-muted-foreground">Agent Filter</Label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[200px]"
          >
            <option value="all">All Agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>

        {/* Month Range View Toggle */}
        <div className="flex flex-col gap-2 justify-end">
          <div className="flex items-center space-x-2 h-10">
            <Checkbox
              id="showMonthly"
              checked={showMonthly}
              onCheckedChange={(checked) => setShowMonthly(checked === true)}
            />
            <Label htmlFor="showMonthly" className="text-sm cursor-pointer">
              Show Monthly Summary
            </Label>
          </div>
        </div>

        {/* Apply Filter Button */}
        <div className="flex flex-col gap-2 justify-end">
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={handleApplyFilter}
            disabled={!isDateValid() || isLoading}
            className="h-10 min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Apply Filter'
            )}
          </Button>
        </div>

        {/* Export PDF Button */}
        <div className="flex flex-col gap-2 justify-end lg:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onExportPDF}
            disabled={!canExport || isExporting || !isDateRangeValid}
            className="h-10 min-w-[140px]"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Show NOTHING until user selects a mode */}
      {selectionMode === null && (
        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
          Please select a date option above to continue
        </div>
      )}

      {/* SINGLE DAY MODE - Show ONE date picker */}
      {selectionMode === 'single' && (
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <Label className="text-xs font-medium text-muted-foreground">Select Date:</Label>
          <DatePicker
            selected={singleDate}
            onChange={(date) => setSingleDate(date)}
            dateFormat="dd/MM/yyyy"
            placeholderText="Click to select a date"
            isClearable
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            maxDate={new Date()}
            className="h-10 w-full sm:w-[220px] px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            wrapperClassName="w-full sm:w-auto"
          />
        </div>
      )}

      {/* DATE RANGE MODE - Show TWO date pickers */}
      {selectionMode === 'range' && (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <Label className="text-xs font-medium text-muted-foreground">From Date:</Label>
            <DatePicker
              selected={fromDate}
              onChange={(date) => {
                setFromDate(date);
                // If toDate is before new fromDate, clear toDate
                if (toDate && date && toDate < date) {
                  setToDate(null);
                }
              }}
              selectsStart
              startDate={fromDate}
              endDate={toDate}
              dateFormat="dd/MM/yyyy"
              placeholderText="Select start date"
              isClearable
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              maxDate={toDate || new Date()}
              className={cn(
                "h-10 w-full sm:w-[180px] px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                dateError ? "border-destructive" : "border-input"
              )}
              wrapperClassName="w-full sm:w-auto"
            />
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <Label className="text-xs font-medium text-muted-foreground">To Date:</Label>
            <DatePicker
              selected={toDate}
              onChange={(date) => setToDate(date)}
              selectsEnd
              startDate={fromDate}
              endDate={toDate}
              minDate={fromDate || undefined}
              maxDate={new Date()}
              dateFormat="dd/MM/yyyy"
              placeholderText="Select end date"
              isClearable
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              disabled={!fromDate}
              className={cn(
                "h-10 w-full sm:w-[180px] px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                !fromDate ? "opacity-50 cursor-not-allowed" : "",
                dateError ? "border-destructive" : "border-input"
              )}
              wrapperClassName="w-full sm:w-auto"
            />
            {!fromDate && (
              <small className="text-xs text-muted-foreground">Please select From Date first</small>
            )}
          </div>

          {/* Quick Select Buttons */}
          <div className="flex flex-wrap gap-2 items-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 text-xs"
              onClick={() => {
                const today = new Date();
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(today.getDate() - 6);
                setFromDate(sevenDaysAgo);
                setToDate(today);
              }}
            >
              Last 7 Days
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 text-xs"
              onClick={() => {
                const today = new Date();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(today.getDate() - 29);
                setFromDate(thirtyDaysAgo);
                setToDate(today);
              }}
            >
              Last 30 Days
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 text-xs"
              onClick={() => {
                const today = new Date();
                setFromDate(new Date(today.getFullYear(), today.getMonth(), 1));
                setToDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
              }}
            >
              This Month
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {dateError && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{dateError}</span>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading data...</span>
        </div>
      )}
    </div>
  );
};
