import { useState, useRef } from 'react';
import { useCaseDocuments, DOCUMENT_TYPES, CaseDocument } from '@/hooks/useCaseDocuments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  FileText,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  Shield,
  File,
  Image,
  FileSpreadsheet,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];

interface CaseDocumentUploadProps {
  caseId: string;
  caseNumber: string;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return Image;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return FileSpreadsheet;
  if (['pdf', 'doc', 'docx'].includes(ext || '')) return FileText;
  return File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const CaseDocumentUpload = ({ caseId, caseNumber }: CaseDocumentUploadProps) => {
  const {
    documents,
    isLoading,
    uploadDocument,
    isUploading,
    deleteDocument,
    isDeleting,
    verifyDocument,
    isVerifying,
    downloadDocument,
  } = useCaseDocuments(caseId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('trade_license');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<CaseDocument | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be under 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    uploadDocument({
      file: selectedFile,
      documentType: selectedDocType,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setSelectedFile(null);
        setNotes('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
    });
  };

  const handleDeleteClick = (doc: CaseDocument) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (documentToDelete) {
      deleteDocument(documentToDelete.id);
    }
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const getDocTypeInfo = (type: DocumentType) => {
    return DOCUMENT_TYPES.find(dt => dt.value === type) || { label: type, icon: '📄' };
  };

  // Group documents by type
  const documentsByType = DOCUMENT_TYPES.reduce((acc, docType) => {
    acc[docType.value] = documents.filter(d => d.documentType === docType.value);
    return acc;
  }, {} as Record<DocumentType, CaseDocument[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Case Documents
        </CardTitle>
        <CardDescription>
          Upload and manage documents for case #{caseNumber}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="border-2 border-dashed rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Upload className="w-4 h-4" />
            Upload New Document
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="docType">Document Type</Label>
              <Select value={selectedDocType} onValueChange={(v) => setSelectedDocType(v as DocumentType)}>
                <SelectTrigger id="docType" className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>
                      <span className="flex items-center gap-2">
                        <span>{dt.icon}</span>
                        {dt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="file">Select File</Label>
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                onChange={handleFileSelect}
                className="mt-1 block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90 file:cursor-pointer"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
              />
            </div>
          </div>

          {selectedFile && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const FileIcon = getFileIcon(selectedFile.name);
                  return <FileIcon className="w-8 h-8 text-muted-foreground" />;
                })()}
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this document..."
              className="mt-1"
              rows={2}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </>
            )}
          </Button>
        </div>

        {/* Documents List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No documents uploaded yet</p>
            <p className="text-sm">Upload documents to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {DOCUMENT_TYPES.filter(dt => documentsByType[dt.value]?.length > 0).map(docType => (
              <div key={docType.value}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{docType.icon}</span>
                  <span className="font-medium text-sm">{docType.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {documentsByType[docType.value].length}
                  </Badge>
                </div>

                <div className="space-y-2 pl-6">
                  {documentsByType[docType.value].map(doc => {
                    const FileIcon = getFileIcon(doc.fileName);

                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <FileIcon className="w-6 h-6 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{doc.fileName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatFileSize(doc.fileSize)}</span>
                              <span>•</span>
                              <span>{format(new Date(doc.createdAt), 'PPp')}</span>
                              <span>•</span>
                              <span>by {doc.uploaderName}</span>
                            </div>
                            {doc.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {doc.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {doc.isVerified ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400 border-green-300">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Verified
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Verified by {doc.verifierName} on {doc.verifiedAt && format(new Date(doc.verifiedAt), 'PPp')}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400 border-yellow-300">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => downloadDocument(doc)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Download</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {!doc.isVerified && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/50"
                                      onClick={() => verifyDocument(doc.id)}
                                      disabled={isVerifying}
                                    >
                                      <Shield className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Mark as Verified</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                                    onClick={() => handleDeleteClick(doc)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
