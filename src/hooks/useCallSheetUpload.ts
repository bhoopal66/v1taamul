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

export interface ColumnMismatch {
  position: number;
  expected: string;
  found: string;
  suggestedFix: 'rename' | 'reorder' | 'missing';
  matchedAt?: number; // If found at wrong position
}

export interface ColumnAnalysis {
  isValid: boolean;
  mismatches: ColumnMismatch[];
  detectedColumns: string[];
  suggestedOrder: string[];
  canAutoFix: boolean;
}

export interface UploadValidationResult {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  duplicateEntries: number;
  contacts: ParsedContact[];
  columnAnalysis?: ColumnAnalysis;
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

export interface UploadProgress {
  stage: 'reading' | 'parsing' | 'validating' | 'uploading' | 'creating_contacts' | 'creating_call_list' | 'complete';
  percentage: number;
  currentItem?: number;
  totalItems?: number;
  estimatedTimeRemaining?: number; // in seconds
  startTime?: number;
}

// Required columns in EXACT order - all are compulsory
const REQUIRED_COLUMNS_IN_ORDER = [
  'name_of_the_company',
  'contact_number',
  'industry',
  'address',
  'area',
  'emirate',
];

// Human-readable column names for error messages
const COLUMN_DISPLAY_NAMES = [
  'Name of the Company',
  'Contact Number',
  'Industry',
  'Address',
  'Area',
  'Emirate',
];

const normalizeColumnName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

// Analyze column structure and provide fix suggestions
const analyzeColumns = (originalColumns: string[]): ColumnAnalysis => {
  const normalizedColumns = originalColumns.map(col => normalizeColumnName(col));
  const mismatches: ColumnMismatch[] = [];
  const suggestedOrder: string[] = [];
  
  // Check each expected column position
  REQUIRED_COLUMNS_IN_ORDER.forEach((expectedCol, expectedIndex) => {
    const actualCol = normalizedColumns[expectedIndex];
    const expectedDisplayName = COLUMN_DISPLAY_NAMES[expectedIndex];
    const actualDisplayName = originalColumns[expectedIndex] || '(empty)';
    
    if (actualCol === expectedCol) {
      // Column is in correct position
      suggestedOrder.push(originalColumns[expectedIndex]);
      return;
    }
    
    // Check if expected column exists elsewhere in the file
    const foundAtIndex = normalizedColumns.findIndex(col => col === expectedCol);
    
    if (foundAtIndex !== -1) {
      // Column exists but in wrong position - suggest reorder
      mismatches.push({
        position: expectedIndex + 1,
        expected: expectedDisplayName,
        found: actualDisplayName,
        suggestedFix: 'reorder',
        matchedAt: foundAtIndex + 1,
      });
      suggestedOrder.push(originalColumns[foundAtIndex]);
    } else {
      // Check if current column might be a renamed version (fuzzy match)
      const isSimilar = actualCol && (
        actualCol.includes(expectedCol.split('_')[0]) ||
        expectedCol.includes(actualCol.split('_')[0]) ||
        levenshteinDistance(actualCol, expectedCol) <= 3
      );
      
      if (isSimilar) {
        // Column might be misspelled - suggest rename
        mismatches.push({
          position: expectedIndex + 1,
          expected: expectedDisplayName,
          found: actualDisplayName,
          suggestedFix: 'rename',
        });
        suggestedOrder.push(expectedDisplayName);
      } else if (!actualCol || actualCol === '') {
        // Column is missing
        mismatches.push({
          position: expectedIndex + 1,
          expected: expectedDisplayName,
          found: '(missing)',
          suggestedFix: 'missing',
        });
        suggestedOrder.push(expectedDisplayName);
      } else {
        // Column is completely different
        mismatches.push({
          position: expectedIndex + 1,
          expected: expectedDisplayName,
          found: actualDisplayName,
          suggestedFix: 'rename',
        });
        suggestedOrder.push(expectedDisplayName);
      }
    }
  });
  
  // Check if all required columns exist somewhere (can be auto-fixed by reordering)
  const allColumnsExist = REQUIRED_COLUMNS_IN_ORDER.every(reqCol => 
    normalizedColumns.includes(reqCol)
  );
  
  return {
    isValid: mismatches.length === 0,
    mismatches,
    detectedColumns: originalColumns.slice(0, 6),
    suggestedOrder,
    canAutoFix: allColumnsExist && mismatches.every(m => m.suggestedFix === 'reorder'),
  };
};

// Simple Levenshtein distance for fuzzy matching
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Helper to calculate ETA
  const calculateETA = (startTime: number, currentItem: number, totalItems: number): number => {
    if (currentItem === 0) return 0;
    const elapsed = (Date.now() - startTime) / 1000;
    const itemsPerSecond = currentItem / elapsed;
    const remainingItems = totalItems - currentItem;
    return Math.ceil(remainingItems / itemsPerSecond);
  };

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

          // Get the original column names in order from the first row
          const firstRow = jsonData[0];
          const originalColumnNames = Object.keys(firstRow);
          
          // Analyze column structure
          const columnAnalysis = analyzeColumns(originalColumnNames);
          
          // Validate exact column count
          if (originalColumnNames.length < REQUIRED_COLUMNS_IN_ORDER.length) {
            // Return analysis with empty data so UI can show suggestions
            resolve({
              totalEntries: 0,
              validEntries: 0,
              invalidEntries: 0,
              duplicateEntries: 0,
              contacts: [],
              columnAnalysis: {
                ...columnAnalysis,
                isValid: false,
                mismatches: REQUIRED_COLUMNS_IN_ORDER.map((col, i) => ({
                  position: i + 1,
                  expected: COLUMN_DISPLAY_NAMES[i],
                  found: originalColumnNames[i] || '(missing)',
                  suggestedFix: originalColumnNames[i] ? 'rename' : 'missing' as const,
                })),
              },
            });
            return;
          }

          // If columns are not valid, return analysis with suggestions
          if (!columnAnalysis.isValid) {
            resolve({
              totalEntries: jsonData.length,
              validEntries: 0,
              invalidEntries: jsonData.length,
              duplicateEntries: 0,
              contacts: [],
              columnAnalysis,
            });
            return;
          }
          
          // Normalize column names for validation
          const normalizedColumns = originalColumnNames.map(col => normalizeColumnName(col));

          // Create column map using original names at correct positions
          const columnMap: Record<string, string> = {
            'name_of_the_company': originalColumnNames[0],
            'contact_number': originalColumnNames[1],
            'industry': originalColumnNames[2],
            'address': originalColumnNames[3],
            'area': originalColumnNames[4],
            'emirate': originalColumnNames[5],
          };

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
            
            // Map to new column structure
            const companyName = String(row[columnMap['name_of_the_company']] || '').trim();
            const phoneNumber = String(row[columnMap['contact_number']] || '').trim();
            const industry = String(row[columnMap['industry']] || '').trim();
            const address = String(row[columnMap['address']] || '').trim();
            const area = String(row[columnMap['area']] || '').trim();
            const emirate = String(row[columnMap['emirate']] || '').trim();

            // Validate ALL required fields (all 6 columns are compulsory)
            if (!companyName) errors.push('Name of the Company is required');
            if (!phoneNumber) errors.push('Contact Number is required');
            if (!industry) errors.push('Industry is required');
            if (!address) errors.push('Address is required');
            if (!area) errors.push('Area is required');
            if (!emirate) errors.push('Emirate is required');

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
              contactPersonName: '', // Not in new template, set empty
              phoneNumber: cleanedPhone || phoneNumber,
              tradeLicenseNumber: '', // Not in new template, set empty
              city: emirate, // Map emirate to city field
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

  // Process file upload with progress tracking
  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setParsedData(null);
    const startTime = Date.now();

    try {
      // Stage 1: Reading file
      setUploadProgress({
        stage: 'reading',
        percentage: 10,
        startTime,
      });

      // Stage 2: Parsing
      setUploadProgress({
        stage: 'parsing',
        percentage: 30,
        startTime,
      });

      const result = await parseFile(file);

      // Stage 3: Validation complete
      setUploadProgress({
        stage: 'validating',
        percentage: 50,
        currentItem: result.totalEntries,
        totalItems: result.totalEntries,
        startTime,
      });

      setParsedData(result);
      
      // Reset progress after a brief delay
      setTimeout(() => {
        setUploadProgress(null);
      }, 500);
      
      return result;
    } catch (error) {
      setUploadProgress(null);
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

      const startTime = Date.now();
      const today = new Date().toISOString().split('T')[0];
      const validContacts = validationResult.contacts.filter(c => c.isValid);
      const totalSteps = 3 + (validContacts.length > 0 ? 2 : 0); // upload record + contacts + call list + rejections

      // Stage 1: Creating upload record
      setUploadProgress({
        stage: 'uploading',
        percentage: 10,
        currentItem: 1,
        totalItems: totalSteps,
        startTime,
      });

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
      if (validContacts.length > 0) {
        // Stage 2: Creating contacts
        setUploadProgress({
          stage: 'creating_contacts',
          percentage: 40,
          currentItem: 0,
          totalItems: validContacts.length,
          startTime,
          estimatedTimeRemaining: calculateETA(startTime, 1, validContacts.length),
        });

        const contactsToInsert = validContacts.map(c => ({
          company_name: c.companyName,
          contact_person_name: c.contactPersonName || c.companyName,
          phone_number: c.phoneNumber,
          trade_license_number: c.tradeLicenseNumber || 'PENDING',
          city: c.city || null,
          industry: c.industry || null,
          area: c.area || null,
          first_uploaded_by: user.id,
          current_owner_agent_id: user.id,
          status: 'new' as const,
        }));

        // Insert contacts in batches for progress tracking
        const batchSize = 50;
        for (let i = 0; i < contactsToInsert.length; i += batchSize) {
          const batch = contactsToInsert.slice(i, i + batchSize);
          const { error: contactsError } = await supabase
            .from('master_contacts')
            .insert(batch);

          if (contactsError) {
            console.error('Error inserting contacts batch:', contactsError);
          }

          const processed = Math.min(i + batchSize, contactsToInsert.length);
          setUploadProgress({
            stage: 'creating_contacts',
            percentage: 40 + Math.round((processed / contactsToInsert.length) * 30),
            currentItem: processed,
            totalItems: validContacts.length,
            startTime,
            estimatedTimeRemaining: calculateETA(startTime, processed, validContacts.length),
          });
        }

        // Stage 3: Creating call list
        setUploadProgress({
          stage: 'creating_call_list',
          percentage: 75,
          currentItem: 0,
          totalItems: validContacts.length,
          startTime,
        });

        // Fetch the inserted contacts by phone numbers
        const phoneNumbers = validContacts.map(c => c.phoneNumber);
        const { data: insertedContacts, error: fetchError } = await supabase
          .from('master_contacts')
          .select('id')
          .eq('current_owner_agent_id', user.id)
          .in('phone_number', phoneNumbers);

        if (fetchError) {
          console.error('Error fetching inserted contacts:', fetchError);
        } else if (insertedContacts && insertedContacts.length > 0) {
          const callListEntries = insertedContacts.map((contact, index) => ({
            agent_id: user.id,
            contact_id: contact.id,
            upload_id: upload.id,
            list_date: today,
            call_order: index + 1,
            call_status: 'pending' as const,
          }));

          // Insert call list in batches
          for (let i = 0; i < callListEntries.length; i += batchSize) {
            const batch = callListEntries.slice(i, i + batchSize);
            const { error: callListError } = await supabase
              .from('approved_call_list')
              .insert(batch);

            if (callListError) {
              console.error('Error creating call list batch:', callListError);
            }

            const processed = Math.min(i + batchSize, callListEntries.length);
            setUploadProgress({
              stage: 'creating_call_list',
              percentage: 75 + Math.round((processed / callListEntries.length) * 20),
              currentItem: processed,
              totalItems: callListEntries.length,
              startTime,
              estimatedTimeRemaining: calculateETA(startTime, processed, callListEntries.length),
            });
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

      // Complete
      setUploadProgress({
        stage: 'complete',
        percentage: 100,
        startTime,
      });

      return upload;
    },
    onSuccess: (data) => {
      toast.success(`Call sheet uploaded and approved! ${data.approved_count || 0} contacts added to your call list.`);
      setParsedData(null);
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
    },
    onError: (error) => {
      setUploadProgress(null);
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
    uploadProgress,
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
