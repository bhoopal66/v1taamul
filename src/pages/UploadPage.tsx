import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, formatDistanceToNow } from 'date-fns';
import { useCallSheetUpload, ParsedContact } from '@/hooks/useCallSheetUpload';
import { cn } from '@/lib/utils';

export const UploadPage: React.FC = () => {
  const { profile } = useAuth();
  const {
    parsedData,
    isProcessing,
    processFile,
    submitUpload,
    isSubmitting,
    uploadHistory,
    historyLoading,
    clearParsedData,
  } = useCallSheetUpload();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = useCallback(() => {
    const sampleData = [
      {
        company_name: 'ABC Trading LLC',
        contact_person_name: 'John Smith',
        phone_number: '+971501234567',
        trade_license_number: 'TL-12345',
        city: 'Dubai',
        industry: 'Trading',
      },
      {
        company_name: 'XYZ Services',
        contact_person_name: 'Jane Doe',
        phone_number: '+971502345678',
        trade_license_number: 'TL-67890',
        city: 'Abu Dhabi',
        industry: 'Services',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // company_name
      { wch: 20 }, // contact_person_name
      { wch: 18 }, // phone_number
      { wch: 18 }, // trade_license_number
      { wch: 12 }, // city
      { wch: 12 }, // industry
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
    await processFile(file);
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
              {!parsedData ? (
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
              ) : (
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

                  {/* Alerts */}
                  {parsedData.invalidEntries > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Some entries have issues</AlertTitle>
                      <AlertDescription>
                        {parsedData.invalidEntries} entries have validation errors and won't be imported.
                        Check the preview below for details.
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
                            <TableHead className="w-24">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredContacts.slice(0, 100).map((contact) => (
                            <TableRow 
                              key={contact.rowNumber}
                              className={cn(!contact.isValid && "bg-destructive/5")}
                            >
                              <TableCell className="text-muted-foreground">{contact.rowNumber}</TableCell>
                              <TableCell className="font-medium">{contact.companyName || '-'}</TableCell>
                              <TableCell>{contact.contactPersonName || '-'}</TableCell>
                              <TableCell className="font-mono text-sm">{contact.phoneNumber || '-'}</TableCell>
                              <TableCell>{contact.tradeLicenseNumber || '-'}</TableCell>
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
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-600" /> trade_license_number
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Optional Columns</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" /> city
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" /> industry
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
                      <div key={upload.id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-medium text-sm truncate flex-1">{upload.fileName}</p>
                          {getStatusBadge(upload.status)}
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
    </div>
  );
};
