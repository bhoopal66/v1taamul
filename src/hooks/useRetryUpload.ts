import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FailedUpload {
  id: string;
  agentId: string;
  agentName: string;
  fileName: string;
  uploadDate: string;
  approvedCount: number;
  actualEntries: number;
  validEntries: number;
  status: string;
}

export interface RetryProgress {
  stage: 'checking' | 'fetching_contacts' | 'creating_list' | 'complete';
  percentage: number;
  message: string;
}

export const useRetryUpload = () => {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const [retryProgress, setRetryProgress] = useState<RetryProgress | null>(null);

  const isSupervisor = ['supervisor', 'operations_head', 'admin', 'super_admin'].includes(userRole || '');

  // Fetch uploads that have approved_count > 0 but no actual call list entries
  const { data: failedUploads, isLoading, refetch } = useQuery({
    queryKey: ['failed-uploads'],
    queryFn: async (): Promise<FailedUpload[]> => {
      const today = new Date().toISOString().split('T')[0];

      // Get today's uploads that are approved
      const { data: uploads, error } = await supabase
        .from('call_sheet_uploads')
        .select('id, agent_id, file_name, upload_timestamp, approved_count, valid_entries, status')
        .eq('upload_date', today)
        .eq('status', 'approved')
        .gt('approved_count', 0)
        .order('upload_timestamp', { ascending: false });

      if (error) throw error;

      if (!uploads || uploads.length === 0) return [];

      // Check actual call list entries for each upload
      const uploadsWithMissingEntries: FailedUpload[] = [];

      for (const upload of uploads) {
        const { count, error: countError } = await supabase
          .from('approved_call_list')
          .select('*', { count: 'exact', head: true })
          .eq('upload_id', upload.id);

        if (countError) {
          console.error('Error counting entries:', countError);
          continue;
        }

        // If approved_count > 0 but actual entries is 0 or significantly less
        if ((count || 0) === 0 || (count || 0) < upload.approved_count * 0.5) {
          // Get agent name
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('full_name, username')
            .eq('id', upload.agent_id)
            .single();

          uploadsWithMissingEntries.push({
            id: upload.id,
            agentId: upload.agent_id,
            agentName: profile?.full_name || profile?.username || 'Unknown',
            fileName: upload.file_name || 'Unknown',
            uploadDate: upload.upload_timestamp || '',
            approvedCount: upload.approved_count || 0,
            actualEntries: count || 0,
            validEntries: upload.valid_entries || 0,
            status: upload.status || 'approved',
          });
        }
      }

      return uploadsWithMissingEntries;
    },
    enabled: isSupervisor,
    refetchInterval: 60000,
  });

  // Retry upload mutation - recreates call list entries from master_contacts
  const retryUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      setRetryProgress({ stage: 'checking', percentage: 10, message: 'Checking upload...' });

      // Get upload details
      const { data: upload, error: uploadError } = await supabase
        .from('call_sheet_uploads')
        .select('*')
        .eq('id', uploadId)
        .single();

      if (uploadError || !upload) throw new Error('Upload not found');

      const agentId = upload.agent_id;
      const today = upload.upload_date;

      setRetryProgress({ stage: 'fetching_contacts', percentage: 20, message: 'Finding contacts...' });

      // Get contacts that were uploaded by this agent on this date
      // We need to find contacts where first_uploaded_by = agent_id and first_upload_date matches
      const uploadDateStart = `${today}T00:00:00.000Z`;
      const uploadDateEnd = `${today}T23:59:59.999Z`;

      const { data: contacts, error: contactsError } = await supabase
        .from('master_contacts')
        .select('id, phone_number, company_name')
        .eq('first_uploaded_by', agentId)
        .gte('first_upload_date', uploadDateStart)
        .lte('first_upload_date', uploadDateEnd);

      if (contactsError) throw contactsError;

      if (!contacts || contacts.length === 0) {
        throw new Error('No contacts found for this upload. The agent may need to re-upload the file.');
      }

      setRetryProgress({ 
        stage: 'fetching_contacts', 
        percentage: 40, 
        message: `Found ${contacts.length} contacts...` 
      });

      // Check which contacts are already in today's call list
      const contactIds = contacts.map(c => c.id);

      const { data: existingEntries } = await supabase
        .from('approved_call_list')
        .select('contact_id')
        .eq('agent_id', agentId)
        .eq('list_date', today)
        .in('contact_id', contactIds);

      const existingContactIds = new Set((existingEntries || []).map(e => e.contact_id));
      const contactsNeedingCallList = contactIds.filter(id => !existingContactIds.has(id));

      if (contactsNeedingCallList.length === 0) {
        setRetryProgress({ stage: 'complete', percentage: 100, message: 'All contacts already in call list!' });
        return { created: 0, total: contacts.length };
      }

      setRetryProgress({ 
        stage: 'creating_list', 
        percentage: 60, 
        message: `Creating ${contactsNeedingCallList.length} call list entries...` 
      });

      // Get max call order for today
      const { data: maxOrderData } = await supabase
        .from('approved_call_list')
        .select('call_order')
        .eq('agent_id', agentId)
        .eq('list_date', today)
        .order('call_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const startOrder = (maxOrderData?.call_order || 0) + 1;

      // Create call list entries
      const callListEntries = contactsNeedingCallList.map((contactId, index) => ({
        agent_id: agentId,
        contact_id: contactId,
        upload_id: uploadId,
        list_date: today,
        call_order: startOrder + index,
        call_status: 'pending' as const,
      }));

      setRetryProgress({ 
        stage: 'creating_list', 
        percentage: 80, 
        message: `Inserting ${callListEntries.length} entries...` 
      });

      const { error: insertError } = await supabase
        .from('approved_call_list')
        .insert(callListEntries);

      if (insertError) throw insertError;

      // Update upload record
      await supabase
        .from('call_sheet_uploads')
        .update({ approved_count: callListEntries.length + existingContactIds.size })
        .eq('id', uploadId);

      setRetryProgress({ stage: 'complete', percentage: 100, message: 'Retry complete!' });

      return { created: callListEntries.length, total: contacts.length };
    },
    onSuccess: (data) => {
      toast.success(`Successfully created ${data.created} call list entries`, {
        description: `Total contacts: ${data.total}`,
      });
      setRetryProgress(null);
      queryClient.invalidateQueries({ queryKey: ['failed-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['call-list'] });
      queryClient.invalidateQueries({ queryKey: ['pending-uploads'] });
    },
    onError: (error) => {
      toast.error(`Retry failed: ${error.message}`);
      setRetryProgress(null);
    },
  });

  // Delete failed upload completely
  const deleteFailedUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      // Delete related call list entries first
      await supabase
        .from('approved_call_list')
        .delete()
        .eq('upload_id', uploadId);

      // Delete rejections
      await supabase
        .from('upload_rejections')
        .delete()
        .eq('upload_id', uploadId);

      // Delete the upload record
      const { error } = await supabase
        .from('call_sheet_uploads')
        .delete()
        .eq('id', uploadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Upload record deleted. Agent can re-upload the file.');
      queryClient.invalidateQueries({ queryKey: ['failed-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  return {
    failedUploads: failedUploads || [],
    isLoading,
    refetch,
    retryUpload: retryUpload.mutate,
    isRetrying: retryUpload.isPending,
    retryProgress,
    deleteFailedUpload: deleteFailedUpload.mutate,
    isDeleting: deleteFailedUpload.isPending,
  };
};
