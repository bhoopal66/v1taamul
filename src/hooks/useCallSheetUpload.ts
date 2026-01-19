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

export interface DuplicateUploadInfo {
  id: string;
  fileName: string;
  uploadTime: string;
  totalEntries: number;
  validEntries: number;
}

export const useCallSheetUpload = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [parsedData, setParsedData] = useState<UploadValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUploadSuccess, setLastUploadSuccess] = useState(false);

  // Check for duplicate uploads (same file name today)
  const checkDuplicateUpload = useCallback(async (fileName: string): Promise<DuplicateUploadInfo | null> => {
    if (!user?.id) return null;

    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('call_sheet_uploads')
      .select('id, file_name, upload_timestamp, total_entries_submitted, valid_entries')
      .eq('agent_id', user.id)
      .eq('upload_date', today)
      .eq('file_name', fileName)
      .order('upload_timestamp', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;

    const upload = data[0];
    return {
      id: upload.id,
      fileName: upload.file_name || fileName,
      uploadTime: upload.upload_timestamp || '',
      totalEntries: upload.total_entries_submitted || 0,
      validEntries: upload.valid_entries || 0,
    };
  }, [user?.id]);

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
        // First, try to insert new contacts one by one to handle duplicates gracefully
        const insertedContactIds: string[] = [];
        const existingContactIds: string[] = [];
        
        for (const c of validContacts) {
          // Try to insert the contact
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
            // If it's a duplicate key error, try to get the existing contact
            if (insertError.code === '23505') {
              // Check if this contact already exists and belongs to this user
              const { data: existingContact } = await supabase
                .from('master_contacts')
                .select('id, current_owner_agent_id')
                .eq('phone_number', c.phoneNumber)
                .maybeSingle();
              
              if (existingContact && existingContact.current_owner_agent_id === user.id) {
                existingContactIds.push(existingContact.id);
              }
            } else {
              console.error('Error inserting contact:', insertError);
            }
          } else if (insertedContact) {
            insertedContactIds.push(insertedContact.id);
          }
        }
        
        const allContactIds = [...insertedContactIds, ...existingContactIds];
        
        if (allContactIds.length > 0) {
          // Check which contacts already have call list entries for today
          const { data: existingCallListEntries } = await supabase
            .from('approved_call_list')
            .select('contact_id')
            .eq('agent_id', user.id)
            .eq('list_date', today)
            .in('contact_id', allContactIds);
          
          const existingContactIdsInCallList = new Set(
            (existingCallListEntries || []).map(e => e.contact_id)
          );
          
          // Only create call list entries for contacts not already in today's list
          const contactsNeedingCallList = allContactIds.filter(
            id => !existingContactIdsInCallList.has(id)
          );
          
          if (contactsNeedingCallList.length > 0) {
            // Get the current max call_order for today
            const { data: maxOrderData } = await supabase
              .from('approved_call_list')
              .select('call_order')
              .eq('agent_id', user.id)
              .eq('list_date', today)
              .order('call_order', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            const startOrder = (maxOrderData?.call_order || 0) + 1;
            
            const callListEntries = contactsNeedingCallList.map((contactId, index) => ({
              agent_id: user.id,
              contact_id: contactId,
              upload_id: upload.id,
              list_date: today,
              call_order: startOrder + index,
              call_status: 'pending' as const,
            }));

            const { error: callListError } = await supabase
              .from('approved_call_list')
              .insert(callListEntries);

            if (callListError) {
              console.error('Error creating call list:', callListError);
              throw new Error(`Failed to create call list: ${callListError.message}`);
            }
            
            console.log(`Successfully created ${callListEntries.length} call list entries (${insertedContactIds.length} new, ${existingContactIds.length} existing)`);
          } else {
            console.log('All contacts already in today\'s call list');
          }
        } else {
          console.warn('No contacts were inserted or found - they may belong to other agents');
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
      toast.success(`Call sheet processed! Contacts added to today's call list.`, {
        description: `${data.approved_count || 0} valid entries processed.`,
      });
      setParsedData(null);
      setLastUploadSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
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
  };
};
