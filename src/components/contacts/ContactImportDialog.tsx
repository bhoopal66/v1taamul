import { useState, useRef } from 'react';
import { useCallSheetUpload, ParsedContact } from '@/hooks/useCallSheetUpload';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Trash2,
  Download,
  Loader2,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

// Only admin and super_admin can import contacts
const ALLOWED_IMPORT_ROLES = ['admin', 'super_admin'];

interface ContactImportDialogProps {
  onImportComplete?: () => void;
}

export const ContactImportDialog = ({ onImportComplete }: ContactImportDialogProps) => {
  const { userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    parsedData,
    isProcessing,
    processFile,
    submitUpload,
    isSubmitting,
    clearParsedData,
  } = useCallSheetUpload();

  // Only render for admin/super_admin
  const canImport = userRole && ALLOWED_IMPORT_ROLES.includes(userRole);
  
  if (!canImport) {
    return null;
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      await processFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = () => {
    if (!selectedFile || !parsedData || parsedData.validEntries === 0) return;
    
    submitUpload(
      { file: selectedFile, validationResult: parsedData },
      {
        onSuccess: () => {
          setIsOpen(false);
          setSelectedFile(null);
          onImportComplete?.();
        },
      }
    );
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedFile(null);
    clearParsedData();
  };

  const downloadTemplate = () => {
    const templateData = [
      ['company_name', 'contact_person_name', 'phone_number', 'trade_license_number', 'city', 'industry'],
      ['ABC Trading LLC', 'John Smith', '+971501234567', 'TL-123456', 'Dubai', 'Trading'],
      ['XYZ Services', 'Jane Doe', '+971502345678', 'TL-234567', 'Abu Dhabi', 'Services'],
      ['Tech Solutions', 'Mike Johnson', '+971503456789', 'TL-345678', 'Sharjah', 'Technology'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // company_name
      { wch: 20 }, // contact_person_name
      { wch: 18 }, // phone_number
      { wch: 20 }, // trade_license_number
      { wch: 15 }, // city
      { wch: 15 }, // industry
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts Template');
    XLSX.writeFile(wb, 'contact_import_template.xlsx');
  };

  const validContacts = parsedData?.contacts.filter(c => c.isValid) || [];
  const invalidContacts = parsedData?.contacts.filter(c => !c.isValid) || [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Contacts
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import contacts. They will be submitted for supervisor approval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!parsedData ? (
            <div className="space-y-4">
              {/* Upload Area */}
              <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Upload Contact File</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop or click to select an Excel (.xlsx, .xls) or CSV file
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Select File
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={downloadTemplate}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Required Columns Info */}
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Required columns:</strong> company_name, contact_person_name, phone_number, trade_license_number
                  <br />
                  <strong>Optional columns:</strong> city, industry
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="gap-1 px-3 py-1">
                  <Users className="w-3 h-3" />
                  {parsedData.totalEntries} Total
                </Badge>
                <Badge variant="default" className="gap-1 px-3 py-1 bg-green-600">
                  <CheckCircle className="w-3 h-3" />
                  {parsedData.validEntries} Valid
                </Badge>
                {parsedData.invalidEntries > 0 && (
                  <Badge variant="destructive" className="gap-1 px-3 py-1">
                    <XCircle className="w-3 h-3" />
                    {parsedData.invalidEntries} Invalid
                  </Badge>
                )}
                {parsedData.duplicateEntries > 0 && (
                  <Badge variant="secondary" className="gap-1 px-3 py-1">
                    <AlertTriangle className="w-3 h-3" />
                    {parsedData.duplicateEntries} Duplicates
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { clearParsedData(); setSelectedFile(null); }}
                  className="ml-auto"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Validation Progress</span>
                  <span className="font-medium">
                    {Math.round((parsedData.validEntries / parsedData.totalEntries) * 100)}% valid
                  </span>
                </div>
                <Progress 
                  value={(parsedData.validEntries / parsedData.totalEntries) * 100} 
                  className="h-2"
                />
              </div>

              {/* Preview Table */}
              <ScrollArea className="h-[350px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b z-10">
                    <tr>
                      <th className="text-left p-3 font-medium w-20">Status</th>
                      <th className="text-left p-3 font-medium">Company</th>
                      <th className="text-left p-3 font-medium">Contact Person</th>
                      <th className="text-left p-3 font-medium">Phone</th>
                      <th className="text-left p-3 font-medium">Trade License</th>
                      <th className="text-left p-3 font-medium">City</th>
                      <th className="text-left p-3 font-medium">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.contacts.map((contact, index) => (
                      <tr 
                        key={index} 
                        className={cn(
                          "border-b transition-colors",
                          !contact.isValid && "bg-destructive/5"
                        )}
                      >
                        <td className="p-3">
                          {contact.isValid ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </td>
                        <td className="p-3 font-medium">{contact.companyName || '-'}</td>
                        <td className="p-3">{contact.contactPersonName || '-'}</td>
                        <td className="p-3 font-mono text-xs">{contact.phoneNumber || '-'}</td>
                        <td className="p-3">{contact.tradeLicenseNumber || '-'}</td>
                        <td className="p-3">{contact.city || '-'}</td>
                        <td className="p-3">
                          {contact.errors.length > 0 && (
                            <span className="text-xs text-destructive">
                              {contact.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>

              {/* File Info */}
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {parsedData && parsedData.validEntries > 0 && (
            <Button 
              onClick={handleImport}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {parsedData.validEntries} Contacts
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContactImportDialog;
