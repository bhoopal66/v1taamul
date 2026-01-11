import { UserExportData } from '@/hooks/useUserManagement';
import * as XLSX from 'xlsx';

export const exportUserDataToExcel = (data: UserExportData) => {
  const workbook = XLSX.utils.book_new();

  // User Info Sheet
  const userSheet = XLSX.utils.json_to_sheet([{
    'User ID': data.user.id,
    'Email': data.user.email,
    'Full Name': data.user.full_name || '',
    'Username': data.user.username,
    'Roles': data.user.roles.join(', '),
    'Status': data.user.is_active ? 'Active' : 'Inactive',
    'Created At': data.user.created_at || '',
    'Last Login': data.user.last_login || '',
  }]);
  XLSX.utils.book_append_sheet(workbook, userSheet, 'User Info');

  // Contacts Sheet
  if (data.contacts.length > 0) {
    const contactsSheet = XLSX.utils.json_to_sheet(data.contacts.map(c => ({
      'Company': c.company_name,
      'Contact Person': c.contact_person_name,
      'Phone': c.phone_number,
      'Trade License': c.trade_license_number,
      'City': c.city || '',
      'Area': c.area || '',
      'Industry': c.industry || '',
      'Status': c.status,
      'Uploaded At': c.first_upload_date,
    })));
    XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Contacts');
  }

  // Call Feedback Sheet
  if (data.callFeedback.length > 0) {
    const feedbackSheet = XLSX.utils.json_to_sheet(data.callFeedback.map(f => ({
      'Contact ID': f.contact_id,
      'Status': f.feedback_status,
      'Notes': f.notes || '',
      'Call Time': f.call_timestamp,
      'WhatsApp Sent': f.whatsapp_sent ? 'Yes' : 'No',
    })));
    XLSX.utils.book_append_sheet(workbook, feedbackSheet, 'Call Feedback');
  }

  // Leads Sheet
  if (data.leads.length > 0) {
    const leadsSheet = XLSX.utils.json_to_sheet(data.leads.map(l => ({
      'Contact ID': l.contact_id,
      'Status': l.lead_status,
      'Score': l.lead_score,
      'Source': l.lead_source,
      'Deal Value': l.deal_value || '',
      'Expected Close': l.expected_close_date || '',
      'Notes': l.notes || '',
      'Created At': l.created_at,
    })));
    XLSX.utils.book_append_sheet(workbook, leadsSheet, 'Leads');
  }

  // Uploads Sheet
  if (data.uploads.length > 0) {
    const uploadsSheet = XLSX.utils.json_to_sheet(data.uploads.map(u => ({
      'File Name': u.file_name,
      'Status': u.status,
      'Total Entries': u.total_entries_submitted,
      'Valid': u.valid_entries,
      'Invalid': u.invalid_entries,
      'Duplicates': u.duplicate_entries,
      'Approved': u.approved_count,
      'Rejected': u.rejected_count,
      'Upload Date': u.upload_date,
    })));
    XLSX.utils.book_append_sheet(workbook, uploadsSheet, 'Uploads');
  }

  // Generate and download
  const filename = `user_data_${data.user.username}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
