import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface ParsedContact {
  rowNumber: number;
  companyName: string;
  contactPersonName: string;
  phoneNumber: string;
  tradeLicenseNumber: string;
  city?: string;
  industry?: string;
  area?: string;
  isValid: boolean;
  errors: string[];
}

export interface UploadValidationResult {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  duplicateEntries: number;
  contacts: ParsedContact[];
}

export interface UploadHistory {
  id: string;
  fileName: string;
  uploadDate: string;
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  duplicateEntries: number;
  status: 'pending' | 'approved' | 'rejected' | 'supplemented';
}

export interface RejectionDetail {
  id: string;
  rowNumber: number;
  companyName: string | null;
  phoneNumber: string | null;
  rejectionReason: string;
}

const REQUIRED_COLUMNS = ['company_name', 'contact_person_name', 'phone_number'];

const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned);
};

const cleanPhoneNumber = (phone: string): string => {
  return phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+');
};

export const useCallSheetUpload = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [parsedData, setParsedData] = useState<UploadValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscribe to realtime updates for upload status changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('upload-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_sheet_uploads',
          filter: `agent_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<{ 
          status: string; 
          file_name: string | null;
          approval_timestamp: string | null;
        }>) => {
          const newRecord = payload.new as { status: string; file_name: string | null } | undefined;
          const oldRecord = payload.old as { status: string } | undefined;
          
          if (!newRecord || !oldRecord) return;
          
          // Only notify if status actually changed
          if (newRecord.status !== oldRecord.status) {
            const fileName = newRecord.file_name || 'Your upload';
            
            if (newRecord.status === 'approved') {
              toast.success(`🎉 ${fileName} has been approved!`, {
                description: 'Your contacts are now ready for calling.',
                duration: 6000,
              });
            } else if (newRecord.status === 'rejected') {
              toast.error(`❌ ${fileName} was rejected`, {
                description: 'Check the upload history for details.',
                duration: 6000,
              });
            }
            
            // Refresh the upload history
            queryClient.invalidateQueries({ queryKey: ['upload-history'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Fetch upload history
  const { data: uploadHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['upload-history', user?.id],
    queryFn: async (): Promise<UploadHistory[]> => {
      const { data, error } = await supabase
        .from('call_sheet_uploads')
        .select('*')
        .eq('agent_id', user?.id)
        .order('upload_timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).map(u => ({
        id: u.id,
        fileName: u.file_name || 'Unknown',
        uploadDate: u.upload_timestamp || u.created_at || '',
        totalEntries: u.total_entries_submitted || 0,
        validEntries: u.valid_entries || 0,
        invalidEntries: u.invalid_entries || 0,
        duplicateEntries: u.duplicate_entries || 0,
        status: u.status as UploadHistory['status'],
      }));
    },
    enabled: !!user?.id,
  });

  // Parse Excel/CSV file
  const parseFile = useCallback(async (file: File): Promise<UploadValidationResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (jsonData.length === 0) {
            reject(new Error('The file appears to be empty'));
            return;
          }

          // Normalize column names
          const firstRow = jsonData[0];
          const columnMap: Record<string, string> = {};
          Object.keys(firstRow).forEach(col => {
            columnMap[normalizeColumnName(col)] = col;
          });

          // Check required columns
          const missingColumns = REQUIRED_COLUMNS.filter(
            required => !Object.keys(columnMap).includes(required)
          );

          if (missingColumns.length > 0) {
            reject(new Error(`Missing required columns: ${missingColumns.join(', ')}`));
            return;
          }

          // Fetch existing phone numbers to check duplicates
          const { data: existingContacts } = await supabase
            .from('master_contacts')
            .select('phone_number');

          const existingPhones = new Set(
            (existingContacts || []).map(c => cleanPhoneNumber(c.phone_number))
          );

          // Fetch DNC list
          const { data: dncList } = await supabase
            .from('do_not_call_list')
            .select('phone_number');

          const dncPhones = new Set(
            (dncList || []).map(d => cleanPhoneNumber(d.phone_number))
          );

          // Parse and validate each row
          const contacts: ParsedContact[] = [];
          const seenInFile = new Set<string>();
          let validCount = 0;
          let invalidCount = 0;
          let duplicateCount = 0;

          jsonData.forEach((row, index) => {
            const errors: string[] = [];
            
            const companyName = String(row[columnMap['company_name']] || '').trim();
            const contactPersonName = String(row[columnMap['contact_person_name']] || '').trim();
            const phoneNumber = String(row[columnMap['phone_number']] || '').trim();
            const tradeLicenseNumber = String(row[columnMap['trade_license_number']] || '').trim();
            const city = columnMap['city'] ? String(row[columnMap['city']] || '').trim() : undefined;
            const industry = columnMap['industry'] ? String(row[columnMap['industry']] || '').trim() : undefined;
            const area = columnMap['area'] ? String(row[columnMap['area']] || '').trim() : undefined;

            // Validate required fields
            if (!companyName) errors.push('Company name is required');
            if (!contactPersonName) errors.push('Contact person name is required');
            if (!phoneNumber) errors.push('Phone number is required');
            // trade_license_number is optional during upload, required when lead is qualified

            // Validate phone format
            if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
              errors.push('Invalid phone number format');
            }

            // Check for duplicates
            const cleanedPhone = cleanPhoneNumber(phoneNumber);
            let isDuplicate = false;

            if (seenInFile.has(cleanedPhone)) {
              errors.push('Duplicate in this file');
              isDuplicate = true;
            } else if (existingPhones.has(cleanedPhone)) {
              errors.push('Already exists in database');
              isDuplicate = true;
            }

            if (dncPhones.has(cleanedPhone)) {
              errors.push('Number is on Do Not Call list');
            }

            seenInFile.add(cleanedPhone);

            const isValid = errors.length === 0;

            if (isDuplicate) {
              duplicateCount++;
            } else if (isValid) {
              validCount++;
            } else {
              invalidCount++;
            }

            contacts.push({
              rowNumber: index + 2, // +2 for header row and 1-indexing
              companyName,
              contactPersonName,
              phoneNumber: cleanedPhone || phoneNumber,
              tradeLicenseNumber,
              city,
              industry,
              area,
              isValid,
              errors,
            });
          });

          resolve({
            totalEntries: contacts.length,
            validEntries: validCount,
            invalidEntries: invalidCount,
            duplicateEntries: duplicateCount,
            contacts,
          });
        } catch (err) {
          reject(new Error('Failed to parse file. Please ensure it is a valid Excel or CSV file.'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // Process file upload
  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setParsedData(null);

    try {
      const result = await parseFile(file);
      setParsedData(result);
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process file');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [parseFile]);

  // Submit upload mutation - auto-approves and creates call list immediately
  const submitUpload = useMutation({
    mutationFn: async ({ file, validationResult }: { file: File; validationResult: UploadValidationResult }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // Create upload record - auto-approved
      const { data: upload, error: uploadError } = await supabase
        .from('call_sheet_uploads')
        .insert({
          agent_id: user.id,
          file_name: file.name,
          file_size: file.size,
          total_entries_submitted: validationResult.totalEntries,
          valid_entries: validationResult.validEntries,
          invalid_entries: validationResult.invalidEntries,
          duplicate_entries: validationResult.duplicateEntries,
          status: 'approved',
          approval_timestamp: new Date().toISOString(),
          approved_count: validationResult.validEntries,
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      // Insert valid contacts and get their IDs
      const validContacts = validationResult.contacts.filter(c => c.isValid);
      
      if (validContacts.length > 0) {
        const contactsToInsert = validContacts.map(c => ({
          company_name: c.companyName,
          contact_person_name: c.contactPersonName,
          phone_number: c.phoneNumber,
          trade_license_number: c.tradeLicenseNumber,
          city: c.city || null,
          industry: c.industry || null,
          area: c.area || null,
          first_uploaded_by: user.id,
          current_owner_agent_id: user.id,
          status: 'new' as const,
        }));

        const { data: insertedContacts, error: contactsError } = await supabase
          .from('master_contacts')
          .insert(contactsToInsert)
          .select('id');

        if (contactsError) {
          console.error('Error inserting contacts:', contactsError);
        } else if (insertedContacts && insertedContacts.length > 0) {
          // Create approved call list entries immediately
          const callListEntries = insertedContacts.map((contact, index) => ({
            agent_id: user.id,
            contact_id: contact.id,
            upload_id: upload.id,
            list_date: today,
            call_order: index + 1,
            call_status: 'pending' as const,
          }));

          const { error: callListError } = await supabase
            .from('approved_call_list')
            .insert(callListEntries);

          if (callListError) {
            console.error('Error creating call list:', callListError);
          }
        }
      }

      // Insert rejection records for invalid entries
      const invalidContacts = validationResult.contacts.filter(c => !c.isValid);
      
      if (invalidContacts.length > 0) {
        const rejectionsToInsert = invalidContacts.map(c => ({
          upload_id: upload.id,
          row_number: c.rowNumber,
          company_name: c.companyName || null,
          phone_number: c.phoneNumber || null,
          rejection_reason: c.errors.join('; '),
        }));

        await supabase
          .from('upload_rejections')
          .insert(rejectionsToInsert);
      }

      return upload;
    },
    onSuccess: (data) => {
      toast.success(`Call sheet uploaded and approved! ${data.approved_count || 0} contacts added to your call list.`);
      setParsedData(null);
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const clearParsedData = useCallback(() => {
    setParsedData(null);
  }, []);

  // Fetch rejection details for a specific upload
  const fetchRejectionDetails = useCallback(async (uploadId: string): Promise<RejectionDetail[]> => {
    const { data, error } = await supabase
      .from('upload_rejections')
      .select('*')
      .eq('upload_id', uploadId)
      .order('row_number', { ascending: true });

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      rowNumber: r.row_number || 0,
      companyName: r.company_name,
      phoneNumber: r.phone_number,
      rejectionReason: r.rejection_reason || 'Unknown reason',
    }));
  }, []);

  // Resubmit a rejected upload (reset status to pending)
  const resubmitUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      const { error } = await supabase
        .from('call_sheet_uploads')
        .update({ 
          status: 'pending',
          approval_timestamp: null,
        })
        .eq('id', uploadId)
        .eq('agent_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Upload resubmitted for approval');
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
    },
    onError: (error) => {
      toast.error(`Resubmit failed: ${error.message}`);
    },
  });

  return {
    parsedData,
    isProcessing,
    processFile,
    submitUpload: submitUpload.mutate,
    isSubmitting: submitUpload.isPending,
    uploadHistory: uploadHistory || [],
    historyLoading,
    clearParsedData,
    fetchRejectionDetails,
    resubmitUpload: resubmitUpload.mutate,
    isResubmitting: resubmitUpload.isPending,
  };
};
