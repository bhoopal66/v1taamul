import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Wand2,
  Phone,
  ArrowRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatDistanceToNow } from 'date-fns';
import { useCallSheetUpload, RejectionDetail, UploadHistory, ParsedContact, DuplicatesByAgent, DuplicateUploadInfo, UploadProgress } from '@/hooks/useCallSheetUpload';
import { TalkTimeUpload } from '@/components/upload/TalkTimeUpload';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

export const UploadPage: React.FC = () => {
  const { profile } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const {
    parsedData,
    isProcessing,
    processFile,
    submitUpload,
    isSubmitting,
    uploadProgress,
    uploadHistory,
    historyLoading,
    clearParsedData,
    fetchRejectionDetails,
    resubmitUpload,
    isResubmitting,
    updateContact,
    autoFixContacts,
    deleteContact,
    lastUploadSuccess,
    resetUploadSuccess,
    checkDuplicateUpload,
    deleteDuplicateUploads,
    isDeletingDuplicates,
  } = useCallSheetUpload();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Debounce ref to prevent rapid file selections
  const lastFileSelectTime = useRef<number>(0);
  const isUploadInProgress = useRef<boolean>(false);
  
  // Rejection details dialog state
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedUploadForRejections, setSelectedUploadForRejections] = useState<UploadHistory | null>(null);
  const [rejectionDetails, setRejectionDetails] = useState<RejectionDetail[]>([]);
  const [loadingRejections, setLoadingRejections] = useState(false);

  // Confirmation dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Duplicate warning dialog state
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [duplicateUploads, setDuplicateUploads] = useState<DuplicateUploadInfo[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingValidation, setPendingValidation] = useState<any>(null);
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
    const sampleData = [
      {
        company_name: 'ABC Trading LLC',
        phone_number: '+971501234567',
        city: 'Dubai',
        industry: 'Trading',
        area: 'Business Bay',
      },
      {
        company_name: 'XYZ Services',
        phone_number: '+971502345678',
        city: 'Abu Dhabi',
        industry: 'Services',
        area: 'Khalifa City',
      },
      {
        company_name: 'Gulf Tech Solutions',
        phone_number: '+971503456789',
        city: 'Sharjah',
        industry: 'Technology',
        area: 'Industrial Area',
      },
      {
        company_name: 'Al Noor Healthcare',
        phone_number: '+971504567890',
        city: 'Dubai',
        industry: 'Healthcare',
        area: 'Dubai Marina',
      },
      {
        company_name: 'Emirates Construction',
        phone_number: '+971505678901',
        city: 'Ajman',
        industry: 'Construction',
        area: 'Al Jurf',
      },
      {
        company_name: 'Royal Finance Group',
        phone_number: '+971506789012',
        city: 'Dubai',
        industry: 'Finance',
        area: 'DIFC',
      },
      {
        company_name: 'Oasis Hospitality',
        phone_number: '+971507890123',
        city: 'Ras Al Khaimah',
        industry: 'Hospitality',
        area: 'Al Hamra',
      },
      {
        company_name: 'Smart Retail Co',
        phone_number: '+971508901234',
        city: 'Fujairah',
        industry: 'Retail',
        area: 'City Center',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // company_name
      { wch: 18 }, // phone_number
      { wch: 12 }, // city
      { wch: 12 }, // industry
      { wch: 15 }, // area
    ];

    XLSX.writeFile(workbook, 'call_sheet_template.xlsx');
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
    // Debounce: prevent rapid file selections (within 3 seconds)
    const now = Date.now();
    if (now - lastFileSelectTime.current < 3000) {
      toast.error('Please wait a moment before uploading another file');
      return;
    }
    
    // Prevent overlapping uploads
    if (isUploadInProgress.current || isProcessing || isSubmitting) {
      toast.error('An upload is already in progress');
      return;
    }
    
    lastFileSelectTime.current = now;
    isUploadInProgress.current = true;
    
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
      toast.error('Please upload a valid Excel (.xlsx, .xls) or CSV file');
      isUploadInProgress.current = false;
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      isUploadInProgress.current = false;
      return;
    }

    try {
      // Check for duplicate uploads across all agents
      const existingUploads = await checkDuplicateUpload(file.name);
      
      setSelectedFile(file);
      const result = await processFile(file);
      
      // If processing failed or returned null, stop here
      if (!result) {
        setSelectedFile(null);
        isUploadInProgress.current = false;
        return;
      }
      
      // If duplicates found, show warning dialog instead of auto-submitting
      if (existingUploads.length > 0 && result.validEntries > 0) {
        setDuplicateUploads(existingUploads);
        setPendingFile(file);
        setPendingValidation(result);
        setDuplicateWarningOpen(true);
        isUploadInProgress.current = false;
        return;
      }
      
      // Auto-submit if there are valid entries and no duplicate
      if (result.validEntries > 0) {
        submitUpload({ file, validationResult: result });
        setSelectedFile(null);
      }
      isUploadInProgress.current = false;
    } catch (error) {
      console.error('File processing error:', error);
      setSelectedFile(null);
      isUploadInProgress.current = false;
      // Error toast is already shown by processFile
    }
  };

  const handleDuplicateConfirm = () => {
    if (pendingFile && pendingValidation) {
      submitUpload({ file: pendingFile, validationResult: pendingValidation });
      setSelectedFile(null);
    }
    setDuplicateWarningOpen(false);
    setDuplicateUploads([]);
    setPendingFile(null);
    setPendingValidation(null);
  };

  const handleDuplicateCancel = () => {
    setDuplicateWarningOpen(false);
    setDuplicateUploads([]);
    setPendingFile(null);
    setPendingValidation(null);
    setSelectedFile(null);
    clearParsedData();
  };

  const handleDeleteAndUpload = async () => {
    // Only delete current user's uploads, not other agents'
    const ownUploadIds = duplicateUploads
      .filter(u => u.isCurrentUser)
      .map(u => u.id);
    
    if (ownUploadIds.length > 0) {
      const success = await deleteDuplicateUploads(ownUploadIds);
      if (!success) return;
    }
    
    if (pendingFile && pendingValidation) {
      submitUpload({ file: pendingFile, validationResult: pendingValidation });
      setSelectedFile(null);
    }
    
    setDuplicateWarningOpen(false);
    setDuplicateUploads([]);
    setPendingFile(null);
    setPendingValidation(null);
  };

  // Count of current user's deletable uploads
  const ownDuplicateCount = duplicateUploads.filter(u => u.isCurrentUser).length;

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
      setConfirmDialogOpen(false);
    }
  };

  const handleOpenConfirmDialog = () => {
    if (selectedFile && parsedData && parsedData.validEntries > 0) {
      setConfirmDialogOpen(true);
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
                Upload an Excel (.xlsx, .xls) or CSV file containing your contact list
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Upload Progress Indicator */}
              {isSubmitting && uploadProgress && (
                <div className="mb-6 p-6 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        <span className="font-medium">{uploadProgress.message}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">{uploadProgress.percentage}%</span>
                    </div>
                    <Progress value={uploadProgress.percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className={uploadProgress.stage === 'preparing' ? 'text-primary font-medium' : ''}>
                        Preparing
                      </span>
                      <span className={uploadProgress.stage === 'processing' ? 'text-primary font-medium' : ''}>
                        Processing Contacts
                      </span>
                      <span className={uploadProgress.stage === 'creating_list' ? 'text-primary font-medium' : ''}>
                        Creating List
                      </span>
                      <span className={uploadProgress.stage === 'complete' ? 'text-primary font-medium' : ''}>
                        Complete
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Success state - show after successful upload */}
              {lastUploadSuccess && !parsedData && !isSubmitting && (
                <div className="mb-6 p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-3 rounded-full bg-green-500/20">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-green-700">Upload Successful!</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your contacts have been added to today's call list
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => navigate('/call-list')}
                        className="gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        View Call List
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetUploadSuccess}
                      >
                        Upload More
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!parsedData && !lastUploadSuccess && !isSubmitting && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5",
                    isDragging && "border-primary bg-primary/10 scale-[1.02]",
                    (isProcessing || isSubmitting) && "pointer-events-none opacity-50"
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
                  
                  {isProcessing || isSubmitting ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <div>
                        <p className="font-medium">{isSubmitting ? 'Uploading...' : 'Processing file...'}</p>
                        <p className="text-sm text-muted-foreground">
                          {isSubmitting ? 'Adding contacts to your call list' : 'Validating contacts and checking for duplicates'}
                        </p>
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
              )}

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

                  {/* Duplicates by Agent Summary - Admin Only */}
                  {isAdmin && parsedData.duplicatesByAgent && parsedData.duplicatesByAgent.length > 0 && (
                    <div className="p-4 rounded-lg border bg-yellow-500/5 border-yellow-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <h4 className="font-medium text-sm">Duplicates by Agent</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {parsedData.duplicatesByAgent.map((agent, idx) => (
                          <div 
                            key={agent.agentId || idx} 
                            className="flex items-center justify-between p-2 rounded-md bg-background"
                          >
                            <span className="text-sm truncate flex-1">{agent.agentName}</span>
                            <Badge variant="secondary" className="ml-2">
                              {agent.count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Valid entries</span>
                      <span className="font-medium">{validPercentage}%</span>
                    </div>
                    <Progress value={validPercentage} className="h-2" />
                  </div>

                  {/* Alerts */}
                  {parsedData.invalidEntries > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="flex items-center justify-between">
                        <span>Some entries have issues</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const result = autoFixContacts();
                            if (result.fixed > 0) {
                              toast.success(`Fixed ${result.fixed} entries automatically!`);
                            } else {
                              toast.info('No entries could be auto-fixed. Please edit manually.');
                            }
                          }}
                          className="ml-2 gap-1.5 h-7 text-xs bg-background hover:bg-muted"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          Fix All
                        </Button>
                      </AlertTitle>
                      <AlertDescription>
                        {parsedData.invalidEntries} entries have validation errors. 
                        Click "Fix All" to auto-correct phone formats & capitalization, or edit rows manually below.
                      </AlertDescription>
                    </Alert>
                  )}

                  {parsedData.validEntries === 0 && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>No valid entries</AlertTitle>
                      <AlertDescription>
                        None of the entries passed validation. Please check your file format and data.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Preview Table */}
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
                            <TableHead>Contact Person</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>License #</TableHead>
                            <TableHead>City</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="w-12">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredContacts.slice(0, 100).map((contact) => (
                            <TableRow 
                              key={contact.rowNumber}
                              className={cn(!contact.isValid && "bg-destructive/5")}
                            >
                              <TableCell className="text-muted-foreground">{contact.rowNumber}</TableCell>
                              <TableCell>
                                {!contact.isValid ? (
                                  <Input
                                    value={contact.companyName}
                                    onChange={(e) => updateContact(contact.rowNumber, 'companyName', e.target.value)}
                                    className={cn(
                                      "h-8 text-sm",
                                      !contact.companyName && "border-destructive"
                                    )}
                                    placeholder="Company name"
                                  />
                                ) : (
                                  <span className="font-medium">{contact.companyName || '-'}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {!contact.isValid ? (
                                  <Input
                                    value={contact.contactPersonName}
                                    onChange={(e) => updateContact(contact.rowNumber, 'contactPersonName', e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Contact person"
                                  />
                                ) : (
                                  contact.contactPersonName || '-'
                                )}
                              </TableCell>
                              <TableCell>
                                {!contact.isValid ? (
                                  <Input
                                    value={contact.phoneNumber}
                                    onChange={(e) => updateContact(contact.rowNumber, 'phoneNumber', e.target.value)}
                                    className={cn(
                                      "h-8 text-sm font-mono",
                                      !contact.phoneNumber && "border-destructive"
                                    )}
                                    placeholder="Phone number"
                                  />
                                ) : (
                                  <span className="font-mono text-sm">{contact.phoneNumber || '-'}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {!contact.isValid ? (
                                  <Input
                                    value={contact.tradeLicenseNumber}
                                    onChange={(e) => updateContact(contact.rowNumber, 'tradeLicenseNumber', e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="License #"
                                  />
                                ) : (
                                  contact.tradeLicenseNumber || '-'
                                )}
                              </TableCell>
                              <TableCell>
                                {!contact.isValid ? (
                                  <Input
                                    value={contact.city || ''}
                                    onChange={(e) => updateContact(contact.rowNumber, 'city', e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="City"
                                  />
                                ) : (
                                  contact.city || '-'
                                )}
                              </TableCell>
                              <TableCell>
                                {!contact.isValid ? (
                                  <Input
                                    value={contact.area || ''}
                                    onChange={(e) => updateContact(contact.rowNumber, 'area', e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Area"
                                  />
                                ) : (
                                  contact.area || '-'
                                )}
                              </TableCell>
                              <TableCell>
                                {!contact.isValid ? (
                                  <Input
                                    value={contact.industry || ''}
                                    onChange={(e) => updateContact(contact.rowNumber, 'industry', e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="Industry"
                                  />
                                ) : (
                                  contact.industry || '-'
                                )}
                              </TableCell>
                              <TableCell>
                                {contact.isValid ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <XCircle className="w-4 h-4 text-destructive" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <ul className="text-xs space-y-1">
                                          {contact.errors.map((err, i) => (
                                            <li key={i}>• {err}</li>
                                          ))}
                                        </ul>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </TableCell>
                              <TableCell>
                                {!contact.isValid && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => deleteContact(contact.rowNumber)}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Remove this entry</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {filteredContacts.length > 100 && (
                        <div className="p-4 text-center text-sm text-muted-foreground border-t">
                          Showing first 100 of {filteredContacts.length} entries
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={handleClear}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                    <Button 
                      onClick={handleOpenConfirmDialog}
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

          {/* Confirmation Dialog */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-primary" />
                  Confirm Upload
                </DialogTitle>
                <DialogDescription>
                  Review the summary below before submitting your call sheet.
                </DialogDescription>
              </DialogHeader>
              
              {parsedData && (
                <div className="space-y-4 py-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">Will be imported</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600 mt-1">{parsedData.validEntries}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Total in file</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">{parsedData.totalEntries}</p>
                    </div>
                  </div>

                  {/* Skipped entries breakdown */}
                  {(parsedData.invalidEntries > 0 || parsedData.duplicateEntries > 0) && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-600">Will be skipped</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {parsedData.invalidEntries > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Invalid entries</span>
                            <span className="font-medium">{parsedData.invalidEntries}</span>
                          </div>
                        )}
                        {parsedData.duplicateEntries > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duplicates</span>
                            <span className="font-medium">{parsedData.duplicateEntries}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File info */}
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{selectedFile?.name}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Confirm & Submit
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Duplicate Upload Warning Dialog */}
          <Dialog open={duplicateWarningOpen} onOpenChange={setDuplicateWarningOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="w-5 h-5" />
                  Duplicate File Detected
                </DialogTitle>
                <DialogDescription>
                  This file has been uploaded {duplicateUploads.length} time{duplicateUploads.length > 1 ? 's' : ''} today. Do you want to upload it again?
                </DialogDescription>
              </DialogHeader>
              
              {duplicateUploads.length > 0 && (
                <div className="space-y-4 py-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Previous uploads today:
                  </div>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-2">
                      {duplicateUploads.map((upload, index) => (
                        <div 
                          key={upload.id} 
                          className={cn(
                            "p-3 rounded-lg border",
                            upload.isCurrentUser 
                              ? "bg-yellow-500/10 border-yellow-500/20" 
                              : "bg-orange-500/10 border-orange-500/20"
                          )}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground font-medium shrink-0">
                                #{duplicateUploads.length - index}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{upload.fileName}</p>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {upload.agentName || 'Unknown'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {upload.uploadTime ? formatDistanceToNow(new Date(upload.uploadTime), { addSuffix: true }) : 'Earlier today'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-medium">{upload.validEntries} / {upload.totalEntries}</p>
                                <p className="text-xs text-muted-foreground">entries</p>
                              </div>
                              {upload.status && (
                                <Badge 
                                  variant={upload.status === 'approved' ? 'default' : upload.status === 'rejected' ? 'destructive' : 'secondary'}
                                  className={cn(
                                    'text-xs',
                                    upload.status === 'approved' && 'bg-green-500/10 text-green-600 border-green-500/20'
                                  )}
                                >
                                  {upload.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Note</AlertTitle>
                    <AlertDescription>
                      Uploading again will add new contacts to your call list. Existing contacts will be skipped automatically.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
                {ownDuplicateCount > 0 ? (
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAndUpload}
                    disabled={isSubmitting || isDeletingDuplicates}
                    className="order-2 sm:order-1"
                  >
                    {isDeletingDuplicates ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete My {ownDuplicateCount} Upload{ownDuplicateCount > 1 ? 's' : ''} & Upload
                  </Button>
                ) : (
                  <div className="text-xs text-muted-foreground self-center order-2 sm:order-1">
                    Other agents' uploads cannot be deleted
                  </div>
                )}
                <div className="flex gap-3 order-1 sm:order-2">
                  <Button variant="outline" onClick={handleDuplicateCancel}>
                    Cancel
                  </Button>
                  <Button onClick={handleDuplicateConfirm} disabled={isSubmitting || isDeletingDuplicates}>
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Upload Anyway
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
                      <CheckCircle2 className="w-3 h-3 text-green-600" /> phone_number
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Optional Columns</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" /> contact_person_name
                    </li>
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
