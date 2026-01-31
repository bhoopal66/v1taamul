import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { uploadLogger } from '@/utils/uploadLogger';

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

export interface DuplicatesByAgent {
  agentId: string | null;
  agentName: string;
  count: number;
}

export interface UploadValidationResult {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  duplicateEntries: number;
  contacts: ParsedContact[];
  duplicatesByAgent?: DuplicatesByAgent[];
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

const REQUIRED_COLUMNS = ['company_name', 'phone_number', 'city', 'area', 'industry'];

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

// IMPORTANT: Use local YYYY-MM-DD (not UTC) to match call list date handling across the app.
// Using toISOString().split('T')[0] can shift the date for users in non-UTC timezones.
const formatLocalDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface DuplicateUploadInfo {
  id: string;
  fileName: string;
  uploadTime: string;
  totalEntries: number;
  validEntries: number;
  status?: string;
  agentId?: string;
  agentName?: string;
  isCurrentUser?: boolean;
}

export interface UploadProgress {
  stage: 'preparing' | 'uploading' | 'processing' | 'creating_list' | 'complete';
  percentage: number;
  message: string;
}

export const useCallSheetUpload = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [parsedData, setParsedData] = useState<UploadValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadSuccess, setLastUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

// Check for all duplicate uploads today (same file name) across ALL agents
  const checkDuplicateUpload = useCallback(async (fileName: string): Promise<DuplicateUploadInfo[]> => {
    if (!user?.id) return [];

    const today = formatLocalDate();
    
    // First, get the duplicate uploads
    const { data: uploads, error } = await supabase
      .from('call_sheet_uploads')
      .select('id, file_name, upload_timestamp, total_entries_submitted, valid_entries, status, agent_id')
      .eq('upload_date', today)
      .eq('file_name', fileName)
      .order('upload_timestamp', { ascending: false });

    if (error || !uploads || uploads.length === 0) return [];

    // Get unique agent IDs to fetch their names
    const agentIds = [...new Set(uploads.map(u => u.agent_id))];
    
    // Fetch agent profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', agentIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    return uploads.map(upload => {
      const profile = profileMap.get(upload.agent_id);
      const agentName = profile?.full_name || profile?.username || 'Unknown';
      const isCurrentUser = upload.agent_id === user.id;
      
      return {
        id: upload.id,
        fileName: upload.file_name || fileName,
        uploadTime: upload.upload_timestamp || '',
        totalEntries: upload.total_entries_submitted || 0,
        validEntries: upload.valid_entries || 0,
        status: upload.status || 'pending',
        agentId: upload.agent_id,
        agentName: isCurrentUser ? 'You' : agentName,
        isCurrentUser,
      };
    });
  }, [user?.id]);

  // Delete duplicate uploads and their related data (with protection for worked entries)
  const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);
  
  // Check if uploads have protected (worked on) call list entries
  const checkProtectedEntries = useCallback(async (uploadIds: string[]): Promise<{
    hasProtected: boolean;
    protectedCount: number;
    safeToDeleteCount: number;
  }> => {
    if (uploadIds.length === 0) return { hasProtected: false, protectedCount: 0, safeToDeleteCount: 0 };

    // Get call list entries for these uploads
    const { data: callListEntries } = await supabase
      .from('approved_call_list')
      .select('id, call_status, contact_id')
      .in('upload_id', uploadIds);

    if (!callListEntries || callListEntries.length === 0) {
      return { hasProtected: false, protectedCount: 0, safeToDeleteCount: 0 };
    }

    // Check for entries that have been called
    const calledEntries = callListEntries.filter(e => e.call_status === 'called');
    
    // Also check if any have feedback logged
    const contactIds = callListEntries.map(e => e.contact_id);
    const { data: feedbackData } = await supabase
      .from('call_feedback')
      .select('contact_id')
      .in('contact_id', contactIds);

    const contactsWithFeedback = new Set(feedbackData?.map(f => f.contact_id) || []);
    
    // Protected = called OR has feedback
    const protectedEntries = callListEntries.filter(e => 
      e.call_status === 'called' || contactsWithFeedback.has(e.contact_id)
    );

    return {
      hasProtected: protectedEntries.length > 0,
      protectedCount: protectedEntries.length,
      safeToDeleteCount: callListEntries.length - protectedEntries.length,
    };
  }, []);
  
  const deleteDuplicateUploads = useCallback(async (uploadIds: string[], forceDelete = false): Promise<boolean> => {
    if (!user?.id || uploadIds.length === 0) return false;
    
    setIsDeletingDuplicates(true);
    
    try {
      // First check for protected entries (unless force delete)
      if (!forceDelete) {
        const protection = await checkProtectedEntries(uploadIds);
        if (protection.hasProtected) {
          toast.error(`Cannot delete: ${protection.protectedCount} contacts have already been called or have feedback logged`, {
            description: 'These records are protected to prevent data loss.',
            duration: 6000,
          });
          setIsDeletingDuplicates(false);
          return false;
        }
      }

      // Delete related records first (foreign key constraints)
      // 1. Delete from upload_rejections
      const { error: rejectionsError } = await supabase
        .from('upload_rejections')
        .delete()
        .in('upload_id', uploadIds);
      
      if (rejectionsError) {
        console.error('Error deleting rejections:', rejectionsError);
      }

      // 2. Only delete call list entries that haven't been worked on
      // First get entries that are safe to delete (pending status, no feedback)
      const { data: callListEntries } = await supabase
        .from('approved_call_list')
        .select('id, contact_id, call_status')
        .in('upload_id', uploadIds);

      if (callListEntries && callListEntries.length > 0) {
        // Get contacts with feedback
        const contactIds = callListEntries.map(e => e.contact_id);
        const { data: feedbackData } = await supabase
          .from('call_feedback')
          .select('contact_id')
          .in('contact_id', contactIds);

        const contactsWithFeedback = new Set(feedbackData?.map(f => f.contact_id) || []);

        // Filter to only delete safe entries
        const safeToDeleteIds = callListEntries
          .filter(e => e.call_status === 'pending' && !contactsWithFeedback.has(e.contact_id))
          .map(e => e.id);

        if (safeToDeleteIds.length > 0) {
          const { error: callListError } = await supabase
            .from('approved_call_list')
            .delete()
            .in('id', safeToDeleteIds);
          
          if (callListError) {
            console.error('Error deleting call list entries:', callListError);
          }
        }

        // Log if some entries were protected
        const protectedCount = callListEntries.length - safeToDeleteIds.length;
        if (protectedCount > 0) {
          console.log(`Protected ${protectedCount} call list entries from deletion (already worked on)`);
        }
      }

      // 3. Delete the uploads themselves
      const { error: uploadsError } = await supabase
        .from('call_sheet_uploads')
        .delete()
        .in('id', uploadIds);
      
      if (uploadsError) {
        throw uploadsError;
      }

      // Refresh upload history
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
      
      toast.success(`Deleted ${uploadIds.length} previous upload${uploadIds.length > 1 ? 's' : ''}`);
      return true;
    } catch (error) {
      console.error('Error deleting duplicate uploads:', error);
      toast.error('Failed to delete previous uploads');
      return false;
    } finally {
      setIsDeletingDuplicates(false);
    }
  }, [user?.id, queryClient, checkProtectedEntries]);

  // Delete an invalid contact from the parsed data
  const deleteContact = useCallback((rowNumber: number) => {
    if (!parsedData) return;

    setParsedData(prev => {
      if (!prev) return prev;

      // Only allow deleting invalid entries
      const contactToDelete = prev.contacts.find(c => c.rowNumber === rowNumber);
      if (!contactToDelete || contactToDelete.isValid) {
        toast.error('Only invalid entries can be deleted');
        return prev;
      }

      const updatedContacts = prev.contacts.filter(c => c.rowNumber !== rowNumber);

      // Recalculate counts
      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      updatedContacts.forEach(c => {
        const hasDuplicateError = c.errors.some(e => 
          e.includes('Duplicate') || e.includes('Already exists')
        );
        if (hasDuplicateError) {
          duplicateCount++;
        } else if (c.isValid) {
          validCount++;
        } else {
          invalidCount++;
        }
      });

      toast.success(`Removed entry #${rowNumber}`);

      return {
        ...prev,
        contacts: updatedContacts,
        totalEntries: updatedContacts.length,
        validEntries: validCount,
        invalidEntries: invalidCount,
        duplicateEntries: duplicateCount,
      };
    });
  }, [parsedData]);

  // Update a contact and revalidate
  const updateContact = useCallback((rowNumber: number, field: keyof ParsedContact, value: string) => {
    if (!parsedData) return;

    setParsedData(prev => {
      if (!prev) return prev;

      const updatedContacts = prev.contacts.map(contact => {
        if (contact.rowNumber !== rowNumber) return contact;

        // Update the field
        const updated = { ...contact, [field]: value };

        // Revalidate
        const errors: string[] = [];
        
        if (!updated.companyName) errors.push('Company name is required');
        if (!updated.phoneNumber) errors.push('Phone number is required');
        if (!updated.city) errors.push('City is required');
        if (!updated.area) errors.push('Area is required');
        if (!updated.industry) errors.push('Industry is required');
        
        if (updated.phoneNumber && !validatePhoneNumber(updated.phoneNumber)) {
          errors.push('Invalid phone number format');
        }

        updated.errors = errors;
        updated.isValid = errors.length === 0;

        return updated;
      });

      // Recalculate counts
      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      updatedContacts.forEach(c => {
        const hasDuplicateError = c.errors.some(e => 
          e.includes('Duplicate') || e.includes('Already exists')
        );
        if (hasDuplicateError) {
          duplicateCount++;
        } else if (c.isValid) {
          validCount++;
        } else {
          invalidCount++;
        }
      });

      return {
        ...prev,
        contacts: updatedContacts,
        validEntries: validCount,
        invalidEntries: invalidCount,
        duplicateEntries: duplicateCount,
      };
    });
  }, [parsedData]);

  // Auto-fix common issues in invalid contacts
  const autoFixContacts = useCallback(() => {
    if (!parsedData) return { fixed: 0 };

    let fixedCount = 0;

    setParsedData(prev => {
      if (!prev) return prev;

      const updatedContacts = prev.contacts.map(contact => {
        if (contact.isValid) return contact;

        const updated = { ...contact };
        let wasFixed = false;

        // Fix 1: Trim whitespace from all fields
        if (updated.companyName !== updated.companyName.trim()) {
          updated.companyName = updated.companyName.trim();
          wasFixed = true;
        }
        if (updated.contactPersonName !== updated.contactPersonName.trim()) {
          updated.contactPersonName = updated.contactPersonName.trim();
          wasFixed = true;
        }
        if (updated.phoneNumber !== updated.phoneNumber.trim()) {
          updated.phoneNumber = updated.phoneNumber.trim();
          wasFixed = true;
        }

        // Fix 2: Clean phone number format
        const cleanedPhone = updated.phoneNumber
          .replace(/[\s\-\(\)\.]/g, '') // Remove spaces, dashes, parens, dots
          .replace(/^00/, '+'); // Convert 00 prefix to +
        
        // Add UAE country code if phone starts with 0 and doesn't have +
        let fixedPhone = cleanedPhone;
        if (cleanedPhone.match(/^0[0-9]{9}$/)) {
          // UAE mobile starting with 0 (e.g., 0501234567)
          fixedPhone = '+971' + cleanedPhone.substring(1);
          wasFixed = true;
        } else if (cleanedPhone.match(/^5[0-9]{8}$/)) {
          // UAE mobile without 0 prefix (e.g., 501234567)
          fixedPhone = '+971' + cleanedPhone;
          wasFixed = true;
        } else if (cleanedPhone !== updated.phoneNumber) {
          wasFixed = true;
        }
        updated.phoneNumber = fixedPhone;

        // Fix 3: Capitalize company name properly
        if (updated.companyName && updated.companyName === updated.companyName.toLowerCase()) {
          updated.companyName = updated.companyName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          wasFixed = true;
        }

        // Fix 4: Capitalize contact person name
        if (updated.contactPersonName && updated.contactPersonName === updated.contactPersonName.toLowerCase()) {
          updated.contactPersonName = updated.contactPersonName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          wasFixed = true;
        }

        // Revalidate after fixes
        const errors: string[] = [];
        
        if (!updated.companyName) errors.push('Company name is required');
        if (!updated.phoneNumber) errors.push('Phone number is required');
        
        if (updated.phoneNumber && !validatePhoneNumber(updated.phoneNumber)) {
          errors.push('Invalid phone number format');
        }

        // Check for duplicate errors (preserve these as they can't be auto-fixed)
        const duplicateErrors = contact.errors.filter(e => 
          e.includes('Duplicate') || e.includes('Already exists') || e.includes('Do Not Call')
        );
        errors.push(...duplicateErrors);

        updated.errors = errors;
        updated.isValid = errors.length === 0;

        if (wasFixed && updated.isValid) {
          fixedCount++;
        }

        return updated;
      });

      // Recalculate counts
      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;

      updatedContacts.forEach(c => {
        const hasDuplicateError = c.errors.some(e => 
          e.includes('Duplicate') || e.includes('Already exists')
        );
        if (hasDuplicateError) {
          duplicateCount++;
        } else if (c.isValid) {
          validCount++;
        } else {
          invalidCount++;
        }
      });

      return {
        ...prev,
        contacts: updatedContacts,
        validEntries: validCount,
        invalidEntries: invalidCount,
        duplicateEntries: duplicateCount,
      };
    });

    return { fixed: fixedCount };
  }, [parsedData]);

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

          // Extract all phone numbers from the file first for batch duplicate check
          const allPhoneNumbers = jsonData.map(row => {
            const phoneNumber = String(row[columnMap['phone_number']] || '').trim();
            return cleanPhoneNumber(phoneNumber);
          }).filter(p => p.length > 0);

          // Use the database function to check duplicates against ALL agents' contacts (bypasses RLS)
          const { data: duplicateCheck, error: duplicateError } = await supabase
            .rpc('check_duplicate_phone_numbers', { phone_numbers: allPhoneNumbers });

          if (duplicateError) {
            console.error('Error checking duplicates:', duplicateError);
          }

          // Build a map of existing phone numbers and their owner names
          const existingPhones = new Map<string, { ownerId: string | null; ownerName: string }>();
          (duplicateCheck || []).forEach((item: { phone_number: string; exists_in_db: boolean; owner_agent_id: string | null; owner_name: string | null }) => {
            if (item.exists_in_db) {
              existingPhones.set(item.phone_number, {
                ownerId: item.owner_agent_id,
                ownerName: item.owner_name || 'Unknown Agent'
              });
            }
          });

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
          
          // Track duplicates by agent for admin summary
          const duplicatesByAgentMap = new Map<string, { agentId: string | null; agentName: string; count: number }>();

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
            if (!phoneNumber) errors.push('Phone number is required');
            if (!city) errors.push('City is required');
            if (!area) errors.push('Area is required');
            if (!industry) errors.push('Industry is required');

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
              const owner = existingPhones.get(cleanedPhone);
              errors.push(`Already exists (owned by ${owner?.ownerName || 'another agent'})`);
              isDuplicate = true;
              
              // Track for agent summary
              const agentKey = owner?.ownerId || 'unknown';
              const existing = duplicatesByAgentMap.get(agentKey);
              if (existing) {
                existing.count++;
              } else {
                duplicatesByAgentMap.set(agentKey, {
                  agentId: owner?.ownerId || null,
                  agentName: owner?.ownerName || 'Unknown Agent',
                  count: 1
                });
              }
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

          // Convert duplicates map to array sorted by count descending
          const duplicatesByAgent = Array.from(duplicatesByAgentMap.values())
            .sort((a, b) => b.count - a.count);

          resolve({
            totalEntries: contacts.length,
            validEntries: validCount,
            invalidEntries: invalidCount,
            duplicateEntries: duplicateCount,
            contacts,
            duplicatesByAgent,
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

      // Start logging session
      await uploadLogger.startSession(user.id, file.name);
      uploadLogger.info('validation', 'Starting upload submission', {
        totalEntries: validationResult.totalEntries,
        validEntries: validationResult.validEntries,
        invalidEntries: validationResult.invalidEntries,
        duplicateEntries: validationResult.duplicateEntries,
      });

      const today = formatLocalDate();
      const validContacts = validationResult.contacts.filter(c => c.isValid);
      const totalSteps = validContacts.length + 3; // upload record + contacts + call list + rejections

      uploadLogger.info('preparation', `Processing ${validContacts.length} valid contacts`, {
        date: today,
        totalSteps,
        validContactPhones: validContacts.slice(0, 5).map(c => c.phoneNumber.slice(-4)), // Log last 4 digits of first 5
      });

      // Server-side duplicate check - prevent same agent uploading same file within 5 minutes
      setUploadProgress({ stage: 'preparing', percentage: 2, message: 'Checking for duplicate uploads...' });
      uploadLogger.info('duplicate_check', 'Checking for recent duplicate uploads');
      
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentDuplicate, error: dupCheckError } = await supabase
        .from('call_sheet_uploads')
        .select('id, upload_timestamp')
        .eq('agent_id', user.id)
        .eq('file_name', file.name)
        .eq('upload_date', today)
        .gte('upload_timestamp', fiveMinutesAgo)
        .order('upload_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (dupCheckError) {
        uploadLogger.error('duplicate_check', 'Duplicate check query failed', {
          error: dupCheckError.message,
          code: dupCheckError.code,
        });
      }
      
      if (recentDuplicate) {
        uploadLogger.error('duplicate_check', 'Recent duplicate found - aborting', {
          existingUploadId: recentDuplicate.id,
          uploadTime: recentDuplicate.upload_timestamp,
        });
        uploadLogger.endSession();
        throw new Error('This file was already uploaded in the last 5 minutes. Please wait before uploading again.');
      }

      uploadLogger.info('duplicate_check', 'No recent duplicates found - proceeding');

      // Step 1: Create upload record
      setUploadProgress({ stage: 'preparing', percentage: 5, message: 'Creating upload record...' });
      uploadLogger.info('upload_record', 'Creating upload record in database');
      
      const { data: upload, error: uploadError } = await supabase
        .from('call_sheet_uploads')
        .insert({
          agent_id: user.id,
          file_name: file.name,
          file_size: file.size,
          upload_date: today,
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

      if (uploadError) {
        uploadLogger.error('upload_record', 'Failed to create upload record', {
          error: uploadError.message,
          code: uploadError.code,
          hint: uploadError.hint,
        });
        uploadLogger.endSession();
        throw uploadError;
      }

      uploadLogger.setUploadId(upload.id);
      uploadLogger.info('upload_record', 'Upload record created successfully', {
        uploadId: upload.id,
        approvedCount: validationResult.validEntries,
      });

      setUploadProgress({ stage: 'uploading', percentage: 15, message: 'Upload record created...' });

      // Step 2: Insert valid contacts
      if (validContacts.length > 0) {
        setUploadProgress({ stage: 'processing', percentage: 20, message: `Processing ${validContacts.length} contacts...` });
        uploadLogger.info('contacts_processing', `Starting to process ${validContacts.length} valid contacts`);
        
        const insertedContactIds: string[] = [];
        const existingContactIds: string[] = [];
        
        const skippedContacts: { phone: string; reason: string }[] = [];
        
        for (let i = 0; i < validContacts.length; i++) {
          const c = validContacts[i];
          const contactProgress = 20 + Math.round((i / validContacts.length) * 50);
          
          if (i % 5 === 0 || i === validContacts.length - 1) {
            setUploadProgress({ 
              stage: 'processing', 
              percentage: contactProgress, 
              message: `Processing contact ${i + 1} of ${validContacts.length}...` 
            });
          }
          
          uploadLogger.debug('contact_insert', `Attempting to insert contact ${i + 1}/${validContacts.length}`, {
            phone: c.phoneNumber.slice(-4),
            company: c.companyName?.substring(0, 20),
          });
          
          const { data: insertedContact, error: insertError } = await supabase
            .from('master_contacts')
            .insert({
              company_name: c.companyName,
              contact_person_name: c.contactPersonName || null,
              phone_number: c.phoneNumber,
              trade_license_number: c.tradeLicenseNumber || null,
              city: c.city || null,
              industry: c.industry || null,
              area: c.area || null,
              first_uploaded_by: user.id,
              current_owner_agent_id: user.id,
              status: 'new' as const,
            })
            .select('id')
            .single();
          
          if (insertError) {
            if (insertError.code === '23505') {
              uploadLogger.info('contact_duplicate', `Contact ${i + 1} already exists - looking up existing record`, {
                phone: c.phoneNumber.slice(-4),
                errorCode: insertError.code,
              });
              
              // Duplicate phone number - use security definer function to find existing contact
              const { data: existingContactId, error: findError } = await supabase
                .rpc('find_contact_by_phone', { phone: c.phoneNumber });
              
              if (!findError && existingContactId) {
                // Add to call list regardless of owner - agents can call any contact
                existingContactIds.push(existingContactId);
                uploadLogger.logContactProcessing(i, validContacts.length, c.phoneNumber, 'existing', existingContactId);
              } else {
                // If RPC fails, try direct query as fallback (will only work if user has access)
                uploadLogger.warn('contact_rpc_fallback', `RPC find_contact_by_phone failed, trying fallback query`, {
                  phone: c.phoneNumber.slice(-4),
                  rpcError: findError?.message,
                });
                
                const { data: fallbackContact, error: fallbackError } = await supabase
                  .from('master_contacts')
                  .select('id')
                  .eq('phone_number', c.phoneNumber)
                  .maybeSingle();
                
                if (fallbackContact) {
                  existingContactIds.push(fallbackContact.id);
                  uploadLogger.logContactProcessing(i, validContacts.length, c.phoneNumber, 'existing', fallbackContact.id);
                } else {
                  skippedContacts.push({ phone: c.phoneNumber, reason: 'Duplicate exists but could not locate' });
                  uploadLogger.logContactProcessing(i, validContacts.length, c.phoneNumber, 'skipped', undefined, 
                    `Duplicate exists but could not locate. RPC error: ${findError?.message}, Fallback error: ${fallbackError?.message}`);
                }
              }
            } else {
              skippedContacts.push({ phone: c.phoneNumber, reason: insertError.message });
              uploadLogger.logContactProcessing(i, validContacts.length, c.phoneNumber, 'error', undefined, 
                `Insert failed: ${insertError.message} (code: ${insertError.code})`);
            }
          } else if (insertedContact) {
            insertedContactIds.push(insertedContact.id);
            uploadLogger.logContactProcessing(i, validContacts.length, c.phoneNumber, 'inserted', insertedContact.id);
          }
        }
        
        // Log contacts processing summary
        uploadLogger.info('contacts_summary', 'Finished processing contacts', {
          inserted: insertedContactIds.length,
          existing: existingContactIds.length,
          skipped: skippedContacts.length,
          total: validContacts.length,
        });
        
        if (skippedContacts.length > 0) {
          uploadLogger.warn('contacts_skipped', `Skipped ${skippedContacts.length} contacts during upload`, {
            skippedDetails: skippedContacts.slice(0, 10), // Log first 10 skipped for debugging
          });
        }
        
        const allContactIds = [...insertedContactIds, ...existingContactIds];
        
        // Step 3: Create call list entries
        if (allContactIds.length > 0) {
          setUploadProgress({ stage: 'creating_list', percentage: 75, message: 'Creating call list entries...' });
          uploadLogger.info('call_list_start', `Starting to create call list entries for ${allContactIds.length} contacts`, {
            allContactIds: allContactIds.slice(0, 5), // Log first 5 IDs
          });
          
          const { data: existingCallListEntries, error: existingListError } = await supabase
            .from('approved_call_list')
            .select('contact_id')
            .eq('agent_id', user.id)
            .eq('list_date', today)
            .in('contact_id', allContactIds);
          
          if (existingListError) {
            uploadLogger.error('call_list_check', 'Failed to check existing call list entries', {
              error: existingListError.message,
              code: existingListError.code,
            });
          }
          
          const existingContactIdsInCallList = new Set(
            (existingCallListEntries || []).map(e => e.contact_id)
          );
          
          uploadLogger.info('call_list_existing', `Found ${existingContactIdsInCallList.size} contacts already in today's call list`, {
            existingCount: existingContactIdsInCallList.size,
          });
          
          const contactsNeedingCallList = allContactIds.filter(
            id => !existingContactIdsInCallList.has(id)
          );
          
          uploadLogger.info('call_list_needed', `Need to create ${contactsNeedingCallList.length} new call list entries`, {
            contactsNeedingCallList: contactsNeedingCallList.slice(0, 5),
          });
          
          if (contactsNeedingCallList.length > 0) {
            setUploadProgress({ stage: 'creating_list', percentage: 85, message: `Adding ${contactsNeedingCallList.length} contacts to call list...` });
            
            const { data: maxOrderData, error: maxOrderError } = await supabase
              .from('approved_call_list')
              .select('call_order')
              .eq('agent_id', user.id)
              .eq('list_date', today)
              .order('call_order', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (maxOrderError) {
              uploadLogger.warn('call_list_order', 'Failed to get max call order', {
                error: maxOrderError.message,
              });
            }
            
            const startOrder = (maxOrderData?.call_order || 0) + 1;
            uploadLogger.info('call_list_order', `Starting call order at ${startOrder}`);
            
            const callListEntries = contactsNeedingCallList.map((contactId, index) => ({
              agent_id: user.id,
              contact_id: contactId,
              upload_id: upload.id,
              list_date: today,
              call_order: startOrder + index,
              call_status: 'pending' as const,
            }));

            uploadLogger.info('call_list_insert', `Inserting ${callListEntries.length} call list entries`, {
              uploadId: upload.id,
              firstEntry: callListEntries[0],
              lastEntry: callListEntries[callListEntries.length - 1],
            });

            const { error: callListError, data: insertedCallList } = await supabase
              .from('approved_call_list')
              .insert(callListEntries)
              .select('id');

            if (callListError) {
              uploadLogger.error('call_list_insert', 'Failed to create call list entries', {
                error: callListError.message,
                code: callListError.code,
                hint: callListError.hint,
                details: callListError.details,
              });
              throw new Error(`Failed to create call list: ${callListError.message}`);
            }
            
            const actualInserted = insertedCallList?.length || 0;
            uploadLogger.info('call_list_success', `Successfully created ${actualInserted} call list entries`, {
              expected: callListEntries.length,
              actual: actualInserted,
              newContacts: insertedContactIds.length,
              existingContacts: existingContactIds.length,
            });
            
            // Update upload record with actual call list count
            const { error: updateError } = await supabase
              .from('call_sheet_uploads')
              .update({ 
                approved_count: actualInserted,
              })
              .eq('id', upload.id);
            
            if (updateError) {
              uploadLogger.warn('upload_update', 'Failed to update approved_count on upload record', {
                error: updateError.message,
                uploadId: upload.id,
              });
            } else {
              uploadLogger.info('upload_update', `Updated upload record approved_count to ${actualInserted}`);
            }
          } else {
            uploadLogger.info('call_list_skip', 'All contacts already in today\'s call list - no new entries needed');
            // Update upload to reflect 0 new entries added (all were duplicates)
            await supabase
              .from('call_sheet_uploads')
              .update({ 
                approved_count: existingCallListEntries?.length || 0,
              })
              .eq('id', upload.id);
          }
        } else {
          uploadLogger.error('contacts_none', 'No contacts were inserted or found - all may have been duplicates or errors occurred', {
            validContactsCount: validContacts.length,
            insertedCount: insertedContactIds.length,
            existingCount: existingContactIds.length,
            skippedCount: skippedContacts.length,
          });
          
          // Update upload record to reflect issue
          await supabase
            .from('call_sheet_uploads')
            .update({ 
              approved_count: 0,
            })
            .eq('id', upload.id);
          
          // Show warning to user
          toast.warning('No new contacts were added to call list', {
            description: 'All contacts may already exist in the system or there were processing errors.',
            duration: 5000,
          });
        }
      }

      // Step 4: Insert rejection records for invalid entries
      setUploadProgress({ stage: 'complete', percentage: 95, message: 'Saving rejection records...' });
      
      const invalidContacts = validationResult.contacts.filter(c => !c.isValid);
      uploadLogger.info('rejections', `Recording ${invalidContacts.length} rejected entries`);
      
      if (invalidContacts.length > 0) {
        const rejectionsToInsert = invalidContacts.map(c => ({
          upload_id: upload.id,
          row_number: c.rowNumber,
          company_name: c.companyName || null,
          phone_number: c.phoneNumber || null,
          rejection_reason: c.errors.join('; '),
        }));

        const { error: rejectionError } = await supabase
          .from('upload_rejections')
          .insert(rejectionsToInsert);
        
        if (rejectionError) {
          uploadLogger.warn('rejections_insert', 'Failed to insert rejection records', {
            error: rejectionError.message,
          });
        }
      }

      setUploadProgress({ stage: 'complete', percentage: 100, message: 'Upload complete!' });
      
      // End logging session and get summary
      const logSummary = uploadLogger.getSummary();
      uploadLogger.info('complete', 'Upload processing complete', logSummary ? { ...logSummary } : undefined);
      await uploadLogger.endSession();

      return upload;
    },
    onSuccess: (data) => {
      toast.success(`Call sheet processed! Contacts added to today's call list.`, {
        description: `${data.approved_count || 0} valid entries processed.`,
      });
      setParsedData(null);
      setLastUploadSuccess(true);
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error) => {
      uploadLogger.error('mutation_error', 'Upload mutation failed', {
        error: error.message,
      });
      uploadLogger.endSession();
      toast.error(`Upload failed: ${error.message}`);
      setUploadProgress(null);
    },
  });

  const clearParsedData = useCallback(() => {
    setParsedData(null);
    setLastUploadSuccess(false);
  }, []);

  const resetUploadSuccess = useCallback(() => {
    setLastUploadSuccess(false);
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
    uploadProgress,
    uploadHistory: uploadHistory || [],
    historyLoading,
    clearParsedData,
    fetchRejectionDetails,
    resubmitUpload: resubmitUpload.mutate,
    isResubmitting: resubmitUpload.isPending,
    updateContact,
    autoFixContacts,
    deleteContact,
    lastUploadSuccess,
    resetUploadSuccess,
    checkDuplicateUpload,
    deleteDuplicateUploads,
    isDeletingDuplicates,
    checkProtectedEntries,
  };
};
