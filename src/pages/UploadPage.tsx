import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileUp,
  Trash2,
  Send,
  Download,
  History,
  Info,
  Loader2,
  FileCheck,
  AlertCircle,
  MoreVertical,
  RotateCcw,
  Eye,
  Building2,
  Phone,
  Factory,
  MapPin,
  Map,
  Landmark,
  ArrowRight,
  ChevronDown,
  Copy,
  Check,
  Shuffle,
  FileWarning,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatDistanceToNow } from 'date-fns';
import { useCallSheetUpload, RejectionDetail, UploadHistory, ColumnAnalysis, UploadProgress } from '@/hooks/useCallSheetUpload';
import { TalkTimeUpload } from '@/components/upload/TalkTimeUpload';
import { cn } from '@/lib/utils';

const SAMPLE_DATA = [
  {
    company: 'ABC Trading LLC',
    contact: '+971501234567',
    industry: 'Trading',
    address: 'Building 5, Office 201',
    area: 'Business Bay',
    emirate: 'Dubai',
  },
  {
    company: 'XYZ Services',
    contact: '+971502345678',
    industry: 'Services',
    address: 'Tower A, Floor 10',
    area: 'Khalifa City',
    emirate: 'Abu Dhabi',
  },
  {
    company: 'Global Tech FZE',
    contact: '+971503456789',
    industry: 'Technology',
    address: 'Warehouse 15',
    area: 'JAFZA',
    emirate: 'Dubai',
  },
];

export const UploadPage: React.FC = () => {
  const { profile } = useAuth();
  const {
    parsedData,
    isProcessing,
    uploadProgress,
    processFile,
    submitUpload,
    isSubmitting,
    uploadHistory,
    historyLoading,
    clearParsedData,
    fetchRejectionDetails,
    resubmitUpload,
    isResubmitting,
  } = useCallSheetUpload();

  // Helper to format time remaining
  const formatTimeRemaining = (seconds: number | undefined): string => {
    if (!seconds || seconds <= 0) return '';
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    return `${minutes}m ${remainingSecs}s remaining`;
  };

  // Get stage display name
  const getStageDisplayName = (stage: UploadProgress['stage']): string => {
    switch (stage) {
      case 'reading': return 'Reading file...';
      case 'parsing': return 'Parsing data...';
      case 'validating': return 'Validating entries...';
      case 'uploading': return 'Creating upload record...';
      case 'creating_contacts': return 'Adding contacts...';
      case 'creating_call_list': return 'Creating call list...';
      case 'complete': return 'Complete!';
      default: return 'Processing...';
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Rejection details dialog state
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedUploadForRejections, setSelectedUploadForRejections] = useState<UploadHistory | null>(null);
  const [rejectionDetails, setRejectionDetails] = useState<RejectionDetail[]>([]);
  const [loadingRejections, setLoadingRejections] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);

  const CSV_HEADER = 'Name of the Company,Contact Number,Industry,Address,Area,Emirate';

  const copyHeaderToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CSV_HEADER);
      setHeaderCopied(true);
      toast.success('Header row copied to clipboard');
      setTimeout(() => setHeaderCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  }, []);

  const handleViewRejections = async (upload: UploadHistory) => {
    setSelectedUploadForRejections(upload);
    setRejectionDialogOpen(true);
    setLoadingRejections(true);
    
    try {
      const details = await fetchRejectionDetails(upload.id);
      setRejectionDetails(details);
    } catch (error) {
      console.error('Failed to fetch rejection details:', error);
      setRejectionDetails([]);
    } finally {
      setLoadingRejections(false);
    }
  };

  const handleResubmit = (uploadId: string) => {
    resubmitUpload(uploadId);
  };

  const downloadTemplate = useCallback(() => {
    // Download the sample CSV file directly
    const link = document.createElement('a');
    link.href = '/sample-call-sheet.csv';
    link.download = 'call_sheet_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileSelect(file);
    }
  }, []);

  const handleFileSelect = async (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];

    const hasValidExtension = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      alert('Please upload a valid Excel (.xlsx, .xls) or CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    const result = await processFile(file);
    
    // Auto-submit if there are valid entries
    if (result && result.validEntries > 0) {
      submitUpload({ file, validationResult: result });
      setSelectedFile(null);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (selectedFile && parsedData) {
      submitUpload({ file: selectedFile, validationResult: parsedData });
      setSelectedFile(null);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    clearParsedData();
    setPreviewFilter('all');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'supplemented':
        return <Badge variant="outline"><FileCheck className="w-3 h-3 mr-1" /> Supplemented</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredContacts = parsedData?.contacts.filter(c => {
    if (previewFilter === 'valid') return c.isValid;
    if (previewFilter === 'invalid') return !c.isValid;
    return true;
  }) || [];

  const validPercentage = parsedData 
    ? Math.round((parsedData.validEntries / parsedData.totalEntries) * 100) 
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Upload Call Sheet</h1>
            <p className="text-muted-foreground mt-1">
              Import your contact list for today's calls
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={downloadTemplate} className="gap-2">
          <Download className="w-4 h-4" />
          Download Template
        </Button>
      </div>

      {/* Required Format Guide */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Required Column Format</span>
            <Badge variant="secondary" className="ml-auto text-xs">All fields required</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">1. Name of the Company</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
              <Phone className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">2. Contact Number</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
              <Factory className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">3. Industry</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">4. Address</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
              <Map className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">5. Area</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
              <Landmark className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">6. Emirate</span>
            </div>
          </div>

          {/* Collapsible Example Preview */}
          <Collapsible open={isExampleOpen} onOpenChange={setIsExampleOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between hover:bg-background/50">
                <span className="flex items-center gap-2 text-sm">
                  <Eye className="w-4 h-4" />
                  View Example Data
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isExampleOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {/* Copy Header Row Button */}
              <div className="flex items-center justify-between p-3 mb-3 rounded-lg bg-muted/50 border">
                <div className="flex-1 overflow-x-auto">
                  <code className="text-xs font-mono text-muted-foreground">{CSV_HEADER}</code>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyHeaderToClipboard}
                        className="ml-3 gap-1.5 shrink-0"
                      >
                        {headerCopied ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Header</span>
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy CSV header row to clipboard</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="rounded-lg border bg-background overflow-hidden">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold text-xs whitespace-nowrap">Name of the Company</TableHead>
                        <TableHead className="font-semibold text-xs whitespace-nowrap">Contact Number</TableHead>
                        <TableHead className="font-semibold text-xs whitespace-nowrap">Industry</TableHead>
                        <TableHead className="font-semibold text-xs whitespace-nowrap">Address</TableHead>
                        <TableHead className="font-semibold text-xs whitespace-nowrap">Area</TableHead>
                        <TableHead className="font-semibold text-xs whitespace-nowrap">Emirate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {SAMPLE_DATA.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">{row.company}</TableCell>
                          <TableCell className="text-sm font-mono">{row.contact}</TableCell>
                          <TableCell className="text-sm">{row.industry}</TableCell>
                          <TableCell className="text-sm">{row.address}</TableCell>
                          <TableCell className="text-sm">{row.area}</TableCell>
                          <TableCell className="text-sm">{row.emirate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                This is how your data should look. Download the template for a ready-to-use file.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Zone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Upload File
              </CardTitle>
              <CardDescription>
                Upload an Excel (.xlsx, .xls) or CSV file matching the format above. Files with incorrect column order will be rejected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Progress Indicator */}
              {(uploadProgress || isSubmitting) && (
                <div className="mb-6 p-6 rounded-xl border-2 border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-4 border-primary/20 flex items-center justify-center">
                        {uploadProgress?.stage === 'complete' ? (
                          <CheckCircle2 className="w-7 h-7 text-green-600" />
                        ) : (
                          <Loader2 className="w-7 h-7 text-primary animate-spin" />
                        )}
                      </div>
                      <div 
                        className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"
                        style={{ 
                          animationDuration: '1s',
                          display: uploadProgress?.stage === 'complete' ? 'none' : 'block'
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">
                        {uploadProgress ? getStageDisplayName(uploadProgress.stage) : 'Uploading...'}
                      </p>
                      {uploadProgress?.currentItem !== undefined && uploadProgress?.totalItems && (
                        <p className="text-sm text-muted-foreground">
                          {uploadProgress.currentItem} of {uploadProgress.totalItems} items
                          {uploadProgress.estimatedTimeRemaining && uploadProgress.estimatedTimeRemaining > 0 && (
                            <span className="ml-2 text-primary">
                              • {formatTimeRemaining(uploadProgress.estimatedTimeRemaining)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">
                        {uploadProgress?.percentage || 0}%
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <Progress 
                      value={uploadProgress?.percentage || 0} 
                      className="h-3"
                    />
                    
                    {/* Stage Indicators */}
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span className={cn(
                        "flex items-center gap-1",
                        ['reading', 'parsing', 'validating', 'uploading', 'creating_contacts', 'creating_call_list', 'complete'].includes(uploadProgress?.stage || '') && "text-primary font-medium"
                      )}>
                        {['validating', 'uploading', 'creating_contacts', 'creating_call_list', 'complete'].includes(uploadProgress?.stage || '') ? (
                          <Check className="w-3 h-3" />
                        ) : null}
                        Parse
                      </span>
                      <span className={cn(
                        "flex items-center gap-1",
                        ['uploading', 'creating_contacts', 'creating_call_list', 'complete'].includes(uploadProgress?.stage || '') && "text-primary font-medium"
                      )}>
                        {['creating_contacts', 'creating_call_list', 'complete'].includes(uploadProgress?.stage || '') ? (
                          <Check className="w-3 h-3" />
                        ) : null}
                        Upload
                      </span>
                      <span className={cn(
                        "flex items-center gap-1",
                        ['creating_contacts', 'creating_call_list', 'complete'].includes(uploadProgress?.stage || '') && "text-primary font-medium"
                      )}>
                        {['creating_call_list', 'complete'].includes(uploadProgress?.stage || '') ? (
                          <Check className="w-3 h-3" />
                        ) : null}
                        Contacts
                      </span>
                      <span className={cn(
                        "flex items-center gap-1",
                        uploadProgress?.stage === 'complete' && "text-green-600 font-medium"
                      )}>
                        {uploadProgress?.stage === 'complete' ? (
                          <Check className="w-3 h-3" />
                        ) : null}
                        Complete
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!parsedData && !uploadProgress && !isSubmitting ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5",
                    isDragging && "border-primary bg-primary/10 scale-[1.02]",
                    isProcessing && "pointer-events-none opacity-50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <div>
                        <p className="font-medium">Processing file...</p>
                        <p className="text-sm text-muted-foreground">Validating contacts and checking for duplicates</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 rounded-full bg-primary/10">
                        <FileUp className="w-10 h-10 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-lg">
                          {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          or click to browse • Max 10MB
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">.xlsx</Badge>
                        <Badge variant="outline">.xls</Badge>
                        <Badge variant="outline">.csv</Badge>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
              
              {parsedData && (
                <div className="space-y-6">
                  {/* File Info */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-10 h-10 text-primary" />
                      <div>
                        <p className="font-medium">{selectedFile?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile?.size || 0 / 1024).toFixed(1)} KB • {parsedData.totalEntries} contacts
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleClear}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Validation Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <p className="text-2xl font-bold">{parsedData.totalEntries}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-500/10 text-center">
                      <p className="text-2xl font-bold text-green-600">{parsedData.validEntries}</p>
                      <p className="text-xs text-muted-foreground">Valid</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/10 text-center">
                      <p className="text-2xl font-bold text-red-600">{parsedData.invalidEntries}</p>
                      <p className="text-xs text-muted-foreground">Invalid</p>
                    </div>
                    <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
                      <p className="text-2xl font-bold text-yellow-600">{parsedData.duplicateEntries}</p>
                      <p className="text-xs text-muted-foreground">Duplicates</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Valid entries</span>
                      <span className="font-medium">{validPercentage}%</span>
                    </div>
                    <Progress value={validPercentage} className="h-2" />
                  </div>

                  {/* Column Mismatch Alert with Suggestions */}
                  {parsedData.columnAnalysis && !parsedData.columnAnalysis.isValid && (
                    <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10">
                      <FileWarning className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-700">Column Format Issue Detected</AlertTitle>
                      <AlertDescription className="mt-3 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Your file columns don't match the required format. Here's how to fix it:
                        </p>
                        
                        {/* Column Comparison Table */}
                        <div className="rounded-lg border bg-background overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="w-16 text-xs">Position</TableHead>
                                <TableHead className="text-xs">Expected Column</TableHead>
                                <TableHead className="text-xs">Your Column</TableHead>
                                <TableHead className="text-xs">Fix</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedData.columnAnalysis.mismatches.map((mismatch) => (
                                <TableRow key={mismatch.position}>
                                  <TableCell className="font-mono text-sm">{mismatch.position}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                                      {mismatch.expected}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                                      {mismatch.found}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {mismatch.suggestedFix === 'reorder' && mismatch.matchedAt && (
                                      <div className="flex items-center gap-1.5 text-xs text-blue-600">
                                        <Shuffle className="w-3 h-3" />
                                        <span>Move from position {mismatch.matchedAt}</span>
                                      </div>
                                    )}
                                    {mismatch.suggestedFix === 'rename' && (
                                      <div className="flex items-center gap-1.5 text-xs text-orange-600">
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Rename to "{mismatch.expected}"</span>
                                      </div>
                                    )}
                                    {mismatch.suggestedFix === 'missing' && (
                                      <div className="flex items-center gap-1.5 text-xs text-red-600">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>Add this column</span>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Suggested Order */}
                        <div className="p-3 rounded-lg bg-muted/50 border">
                          <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                            <Info className="w-3 h-3" />
                            Correct column order:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {parsedData.columnAnalysis.suggestedOrder.map((col, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {i + 1}. {col}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Can Auto-Fix Notice */}
                        {parsedData.columnAnalysis.canAutoFix && (
                          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                            <p className="text-xs text-blue-700 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <strong>Good news!</strong> All required columns are present. You just need to reorder them in your spreadsheet.
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5">
                            <Trash2 className="w-3.5 h-3.5" />
                            Clear & Try Again
                          </Button>
                          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            Download Template
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Regular Alerts for row-level issues */}
                  {parsedData.columnAnalysis?.isValid && parsedData.invalidEntries > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Some entries have issues</AlertTitle>
                      <AlertDescription>
                        {parsedData.invalidEntries} entries have validation errors and won't be imported.
                        Check the preview below for details.
                      </AlertDescription>
                    </Alert>
                  )}

                  {parsedData.columnAnalysis?.isValid && parsedData.validEntries === 0 && parsedData.totalEntries > 0 && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>No valid entries</AlertTitle>
                      <AlertDescription>
                        None of the entries passed validation. Please check your file format and data.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Preview Table - only show when columns are valid */}
                  {parsedData.columnAnalysis?.isValid !== false && parsedData.contacts.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Preview Data
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          variant={previewFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPreviewFilter('all')}
                        >
                          All ({parsedData.totalEntries})
                        </Button>
                        <Button
                          variant={previewFilter === 'valid' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPreviewFilter('valid')}
                        >
                          Valid ({parsedData.validEntries})
                        </Button>
                        <Button
                          variant={previewFilter === 'invalid' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPreviewFilter('invalid')}
                        >
                          Issues ({parsedData.invalidEntries + parsedData.duplicateEntries})
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="h-[300px] rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Contact Number</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead>Emirate</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredContacts.slice(0, 100).map((contact) => {
                            // Helper to check if a specific field has an error
                            const hasFieldError = (fieldName: string) => 
                              contact.errors.some(err => err.toLowerCase().includes(fieldName.toLowerCase()));
                            
                            // Helper to get error message for a field
                            const getFieldErrors = (fieldName: string) => 
                              contact.errors.filter(err => err.toLowerCase().includes(fieldName.toLowerCase()));

                            const renderCell = (value: string | undefined, fieldName: string, isMono?: boolean) => {
                              const fieldErrors = getFieldErrors(fieldName);
                              const hasError = fieldErrors.length > 0;
                              
                              if (hasError) {
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className={cn(
                                          "flex items-center gap-1 px-1.5 py-0.5 -mx-1.5 rounded bg-destructive/10 border border-destructive/30 cursor-help",
                                          isMono && "font-mono text-sm"
                                        )}>
                                          <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                                          <span className="text-destructive truncate">{value || '-'}</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        <div className="space-y-1">
                                          <p className="font-semibold text-xs text-destructive">Validation Error</p>
                                          <ul className="text-xs space-y-0.5">
                                            {fieldErrors.map((err, i) => (
                                              <li key={i}>• {err}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              }
                              
                              return <span className={cn(isMono && "font-mono text-sm")}>{value || '-'}</span>;
                            };

                            // Check for general errors not tied to specific fields
                            const generalErrors = contact.errors.filter(err => 
                              !['company', 'contact', 'phone', 'industry', 'address', 'area', 'emirate', 'number']
                                .some(field => err.toLowerCase().includes(field))
                            );

                            return (
                              <TableRow 
                                key={contact.rowNumber}
                                className={cn(!contact.isValid && "bg-destructive/5")}
                              >
                                <TableCell className="text-muted-foreground">{contact.rowNumber}</TableCell>
                                <TableCell className="font-medium">{renderCell(contact.companyName, 'company')}</TableCell>
                                <TableCell>{renderCell(contact.phoneNumber, 'contact number', true)}</TableCell>
                                <TableCell>{renderCell(contact.industry, 'industry')}</TableCell>
                                <TableCell>{renderCell(contact.city, 'address')}</TableCell>
                                <TableCell>{renderCell(contact.area, 'area')}</TableCell>
                                <TableCell>{renderCell(contact.city, 'emirate')}</TableCell>
                                <TableCell>
                                  {contact.isValid ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <div className="flex items-center gap-1">
                                            <XCircle className="w-4 h-4 text-destructive" />
                                            <span className="text-xs text-destructive">{contact.errors.length}</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="max-w-xs">
                                          <div className="space-y-1">
                                            <p className="font-semibold text-xs">All Errors ({contact.errors.length})</p>
                                            <ul className="text-xs space-y-0.5">
                                              {contact.errors.map((err, i) => (
                                                <li key={i}>• {err}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {filteredContacts.length > 100 && (
                        <div className="p-4 text-center text-sm text-muted-foreground border-t">
                          Showing first 100 of {filteredContacts.length} entries
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={handleClear}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={parsedData.validEntries === 0 || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Submit for Approval ({parsedData.validEntries} contacts)
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Format Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4" />
                Required File Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Required Columns</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-600" /> company_name
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-600" /> contact_person_name
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-600" /> phone_number
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Optional Columns</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" /> trade_license_number
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" /> city
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" /> industry
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" /> area
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
                <p className="text-muted-foreground">
                  <strong>Tip:</strong> Column names are flexible - spaces, hyphens, and different cases are accepted 
                  (e.g., "Company Name", "company-name", "COMPANY_NAME" all work).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Talk Time Upload */}
          <TalkTimeUpload />
        </div>

        {/* Upload History Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Recent Uploads
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : uploadHistory.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No uploads yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="divide-y">
                    {uploadHistory.map((upload) => (
                      <div key={upload.id} className="p-4 hover:bg-muted/50 transition-colors group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-medium text-sm truncate flex-1">{upload.fileName}</p>
                          <div className="flex items-center gap-1">
                            {getStatusBadge(upload.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(upload.invalidEntries > 0 || upload.status === 'rejected') && (
                                  <DropdownMenuItem onClick={() => handleViewRejections(upload)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Issues
                                  </DropdownMenuItem>
                                )}
                                {upload.status === 'rejected' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleResubmit(upload.id)}
                                    disabled={isResubmitting}
                                  >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Resubmit for Approval
                                  </DropdownMenuItem>
                                )}
                                {upload.status === 'pending' && (
                                  <DropdownMenuItem disabled className="text-muted-foreground">
                                    <Clock className="w-4 h-4 mr-2" />
                                    Awaiting Review
                                  </DropdownMenuItem>
                                )}
                                {upload.status === 'approved' && (
                                  <DropdownMenuItem disabled className="text-muted-foreground">
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Already Approved
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{upload.totalEntries} total</span>
                          <span className="text-green-600">{upload.validEntries} valid</span>
                          {upload.invalidEntries > 0 && (
                            <span className="text-red-600">{upload.invalidEntries} invalid</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {upload.uploadDate && formatDistanceToNow(new Date(upload.uploadDate), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rejection Details Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Rejection Details
            </DialogTitle>
            <DialogDescription>
              {selectedUploadForRejections && (
                <>
                  Issues found in <strong>{selectedUploadForRejections.fileName}</strong>
                  {' '} — {selectedUploadForRejections.invalidEntries + selectedUploadForRejections.duplicateEntries} entries with problems
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {loadingRejections ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading details...</p>
            </div>
          ) : rejectionDetails.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No detailed rejection records found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejectionDetails.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell className="text-muted-foreground">{detail.rowNumber}</TableCell>
                      <TableCell className="font-medium">{detail.companyName || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{detail.phoneNumber || '-'}</TableCell>
                      <TableCell>
                        <span className="text-sm text-destructive">{detail.rejectionReason}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {selectedUploadForRejections?.status === 'rejected' && (
            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={() => {
                  handleResubmit(selectedUploadForRejections.id);
                  setRejectionDialogOpen(false);
                }}
                disabled={isResubmitting}
              >
                {isResubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Resubmit for Approval
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
