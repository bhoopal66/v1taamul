import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ContactExportData {
  callOrder: number;
  companyName: string;
  contactPersonName: string;
  phoneNumber: string;
  tradeLicenseNumber: string;
  city: string | null;
  industry: string | null;
  area: string | null;
  callStatus: string;
  lastFeedback: string | null;
  lastNotes: string | null;
  calledAt: string | null;
  agentName?: string;
}

const formatContactsForExport = (contacts: ContactExportData[]) => {
  // Check if any contact has agentName to determine if we should include the column
  const hasAgentName = contacts.some(c => c.agentName);
  
  return contacts.map((contact, index) => {
    const baseData: Record<string, string | number> = {
      '#': index + 1,
      'Call Order': contact.callOrder,
      'Company Name': contact.companyName,
      'Contact Person': contact.contactPersonName,
      'Phone Number': contact.phoneNumber,
      'Trade License': contact.tradeLicenseNumber,
      'City': contact.city || '-',
      'Area': contact.area || '-',
      'Industry': contact.industry || '-',
      'Call Status': contact.callStatus.charAt(0).toUpperCase() + contact.callStatus.slice(1),
      'Feedback': contact.lastFeedback 
        ? contact.lastFeedback.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : '-',
      'Notes': contact.lastNotes || '-',
      'Called At': contact.calledAt ? format(new Date(contact.calledAt), 'yyyy-MM-dd HH:mm') : '-',
    };
    
    // Add Agent Name column if exporting team data
    if (hasAgentName) {
      baseData['Agent Name'] = contact.agentName || '-';
    }
    
    return baseData;
  });
};

export const exportContactsToCSV = (contacts: ContactExportData[], filename?: string) => {
  const data = formatContactsForExport(contacts);
  
  if (data.length === 0) {
    throw new Error('No contacts to export');
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = String(row[header as keyof typeof row] || '');
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `contacts_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportContactsToExcel = (contacts: ContactExportData[], filename?: string) => {
  const data = formatContactsForExport(contacts);
  
  if (data.length === 0) {
    throw new Error('No contacts to export');
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Check if agent name column is included
  const hasAgentName = data.length > 0 && 'Agent Name' in data[0];
  
  // Set column widths
  const columnWidths = [
    { wch: 4 },   // #
    { wch: 10 },  // Call Order
    { wch: 30 },  // Company Name
    { wch: 25 },  // Contact Person
    { wch: 15 },  // Phone Number
    { wch: 20 },  // Trade License
    { wch: 15 },  // City
    { wch: 15 },  // Area
    { wch: 20 },  // Industry
    { wch: 12 },  // Call Status
    { wch: 15 },  // Feedback
    { wch: 40 },  // Notes
    { wch: 18 },  // Called At
    ...(hasAgentName ? [{ wch: 25 }] : []),  // Agent Name
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

  XLSX.writeFile(workbook, filename || `contacts_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};
