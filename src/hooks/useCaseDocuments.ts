import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];

export interface CaseDocument {
  id: string;
  caseId: string;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  uploadedBy: string;
  isVerified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  uploaderName?: string;
  verifierName?: string;
}

export const DOCUMENT_TYPES: { value: DocumentType; label: string; icon: string }[] = [
  { value: 'trade_license', label: 'Trade License', icon: '📄' },
  { value: 'emirates_id', label: 'Emirates ID', icon: '🪪' },
  { value: 'passport', label: 'Passport', icon: '📕' },
  { value: 'visa', label: 'Visa', icon: '📋' },
  { value: 'bank_statement', label: 'Bank Statement', icon: '🏦' },
  { value: 'financials', label: 'Financial Documents', icon: '📊' },
  { value: 'moa', label: 'Memorandum of Association', icon: '📜' },
  { value: 'power_of_attorney', label: 'Power of Attorney', icon: '⚖️' },
  { value: 'other', label: 'Other', icon: '📎' },
];

export const useCaseDocuments = (caseId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['case-documents', caseId],
    queryFn: async (): Promise<CaseDocument[]> => {
      if (!caseId) return [];

      const { data, error } = await supabase
        .from('case_documents')
        .select(`
          *,
          uploader:uploaded_by(full_name),
          verifier:verified_by(full_name)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(doc => ({
        id: doc.id,
        caseId: doc.case_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileSize: doc.file_size,
        uploadedBy: doc.uploaded_by,
        isVerified: doc.is_verified ?? false,
        verifiedBy: doc.verified_by,
        verifiedAt: doc.verified_at,
        notes: doc.notes,
        createdAt: doc.created_at,
        uploaderName: (doc.uploader as any)?.full_name || 'Unknown',
        verifierName: (doc.verifier as any)?.full_name || null,
      }));
    },
    enabled: !!caseId && !!user?.id,
  });

  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      documentType,
      notes,
    }: {
      file: File;
      documentType: DocumentType;
      notes?: string;
    }) => {
      if (!caseId || !user?.id) {
        throw new Error('Case ID and user required');
      }

      // Create unique file path
      const fileExt = file.name.split('.').pop();
      const filePath = `${caseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { error: dbError } = await supabase
        .from('case_documents')
        .insert({
          case_id: caseId,
          document_type: documentType,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          uploaded_by: user.id,
          notes: notes || null,
        });

      if (dbError) {
        // Clean up storage on DB error
        await supabase.storage.from('case-documents').remove([filePath]);
        throw dbError;
      }
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['case-documents', caseId] });
    },
    onError: (error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string) => {
      const doc = documents?.find(d => d.id === documentId);
      if (!doc) throw new Error('Document not found');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('case-documents')
        .remove([doc.filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('case_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['case-documents', caseId] });
    },
    onError: (error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });

  const verifyDocument = useMutation({
    mutationFn: async (documentId: string) => {
      if (!user?.id) throw new Error('User required');

      const { error } = await supabase
        .from('case_documents')
        .update({
          is_verified: true,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Document verified');
      queryClient.invalidateQueries({ queryKey: ['case-documents', caseId] });
    },
    onError: (error) => {
      toast.error(`Failed to verify document: ${error.message}`);
    },
  });

  const getDownloadUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(filePath, 60); // 60 seconds expiry

    if (error) throw error;
    return data.signedUrl;
  };

  const downloadDocument = async (doc: CaseDocument) => {
    try {
      const url = await getDownloadUrl(doc.filePath);
      window.open(url, '_blank');
    } catch (error: any) {
      toast.error(`Failed to download: ${error.message}`);
    }
  };

  return {
    documents: documents || [],
    isLoading,
    refetch,
    uploadDocument: uploadDocument.mutate,
    isUploading: uploadDocument.isPending,
    deleteDocument: deleteDocument.mutate,
    isDeleting: deleteDocument.isPending,
    verifyDocument: verifyDocument.mutate,
    isVerifying: verifyDocument.isPending,
    downloadDocument,
    getDownloadUrl,
  };
};
