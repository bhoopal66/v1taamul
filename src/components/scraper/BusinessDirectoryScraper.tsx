import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, Download, Upload, RefreshCw, PhoneCall } from 'lucide-react';
import { firecrawlApi, ExtractedCompany } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export const BusinessDirectoryScraper = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAddingToCallList, setIsAddingToCallList] = useState(false);
  const [companies, setCompanies] = useState<ExtractedCompany[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [sourceUrl, setSourceUrl] = useState<string>('');

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setCompanies([]);
    setSelectedCompanies(new Set());

    try {
      const response = await firecrawlApi.extractCompanies(url);

      if (response.success && response.companies) {
        setCompanies(response.companies);
        setSourceUrl(response.sourceUrl || url);
        setSelectedCompanies(new Set(response.companies.map((_, i) => i)));
        
        toast({
          title: 'Extraction Complete',
          description: `Found ${response.companies.length} companies`,
        });
      } else {
        toast({
          title: 'Extraction Failed',
          description: response.error || 'Failed to extract company data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Error',
        description: 'Failed to scrape the page. Please check the URL and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCompany = (index: number) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedCompanies(newSelected);
  };

  const toggleAll = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companies.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (!user?.id || selectedCompanies.size === 0) return;

    setIsImporting(true);
    const selectedList = companies.filter((_, i) => selectedCompanies.has(i));
    
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    for (const company of selectedList) {
      try {
        // Check if phone number already exists
        const { data: existing } = await supabase
          .from('master_contacts')
          .select('id')
          .eq('phone_number', company.phone_number)
          .maybeSingle();

        if (existing) {
          duplicates++;
          continue;
        }

        // Insert new contact
        const { error } = await supabase
          .from('master_contacts')
          .insert({
            company_name: company.company_name,
            phone_number: company.phone_number,
            contact_person_name: company.contact_person_name || null,
            industry: company.industry || null,
            city: company.city || null,
            area: company.area || null,
            first_uploaded_by: user.id,
            current_owner_agent_id: user.id,
            first_upload_date: new Date().toISOString(),
          });

        if (error) {
          console.error('Import error:', error);
          errors++;
        } else {
          imported++;
        }
      } catch (err) {
        console.error('Import error:', err);
        errors++;
      }
    }

    setIsImporting(false);

    toast({
      title: 'Import Complete',
      description: `Imported: ${imported}, Duplicates: ${duplicates}, Errors: ${errors}`,
      variant: errors > 0 ? 'destructive' : 'default',
    });

    if (imported > 0) {
      // Clear imported companies from the list
      const remainingCompanies = companies.filter((_, i) => !selectedCompanies.has(i));
      setCompanies(remainingCompanies);
      setSelectedCompanies(new Set());
    }
  };

  const handleAddToCallList = async () => {
    if (!user?.id || selectedCompanies.size === 0) return;

    setIsAddingToCallList(true);
    const selectedList = companies.filter((_, i) => selectedCompanies.has(i));
    const today = format(new Date(), 'yyyy-MM-dd');
    
    let addedToList = 0;
    let duplicates = 0;
    let errors = 0;

    for (const company of selectedList) {
      try {
        // Check if phone number already exists in master_contacts
        let { data: existing } = await supabase
          .from('master_contacts')
          .select('id')
          .eq('phone_number', company.phone_number)
          .maybeSingle();

        let contactId: string;

        if (existing) {
          contactId = existing.id;
        } else {
          // Insert new contact first
          const { data: newContact, error: insertError } = await supabase
            .from('master_contacts')
            .insert({
              company_name: company.company_name,
              phone_number: company.phone_number,
              contact_person_name: company.contact_person_name || null,
              industry: company.industry || null,
              city: company.city || null,
              area: company.area || null,
              first_uploaded_by: user.id,
              current_owner_agent_id: user.id,
              first_upload_date: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (insertError || !newContact) {
            console.error('Contact insert error:', insertError);
            errors++;
            continue;
          }
          contactId = newContact.id;
        }

        // Check if already in today's call list for this agent
        const { data: existingInList } = await supabase
          .from('approved_call_list')
          .select('id')
          .eq('agent_id', user.id)
          .eq('contact_id', contactId)
          .eq('list_date', today)
          .maybeSingle();

        if (existingInList) {
          duplicates++;
          continue;
        }

        // Get current max call_order for today
        const { data: maxOrderData } = await supabase
          .from('approved_call_list')
          .select('call_order')
          .eq('agent_id', user.id)
          .eq('list_date', today)
          .order('call_order', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextOrder = (maxOrderData?.call_order || 0) + 1;

        // Add to call list
        const { error: listError } = await supabase
          .from('approved_call_list')
          .insert({
            agent_id: user.id,
            contact_id: contactId,
            list_date: today,
            call_order: nextOrder,
            call_status: 'pending',
          });

        if (listError) {
          console.error('Call list insert error:', listError);
          errors++;
        } else {
          addedToList++;
        }
      } catch (err) {
        console.error('Add to call list error:', err);
        errors++;
      }
    }

    setIsAddingToCallList(false);

    toast({
      title: 'Added to Call List',
      description: `Added: ${addedToList}, Already in list: ${duplicates}, Errors: ${errors}`,
      variant: errors > 0 ? 'destructive' : 'default',
    });

    if (addedToList > 0) {
      const remainingCompanies = companies.filter((_, i) => !selectedCompanies.has(i));
      setCompanies(remainingCompanies);
      setSelectedCompanies(new Set());
    }
  };

  const exportToCSV = () => {
    const selectedList = companies.filter((_, i) => selectedCompanies.has(i));
    if (selectedList.length === 0) return;

    const headers = ['Company Name', 'Phone Number', 'Contact Person', 'Industry', 'City', 'Area'];
    const rows = selectedList.map(c => [
      c.company_name,
      c.phone_number,
      c.contact_person_name || '',
      c.industry || '',
      c.city || '',
      c.area || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `scraped-companies-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Business Directory Scraper
        </CardTitle>
        <CardDescription>
          Extract company data from business directories and import directly into your contacts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleScrape} className="flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yellowpages.ae/category/..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !url.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Extract
              </>
            )}
          </Button>
        </form>

        {companies.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedCompanies.size} of {companies.length} selected
                </Badge>
                {sourceUrl && (
                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                    from: {sourceUrl}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  disabled={selectedCompanies.size === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImport}
                  disabled={selectedCompanies.size === 0 || isImporting || isAddingToCallList}
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import to Contacts
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddToCallList}
                  disabled={selectedCompanies.size === 0 || isImporting || isAddingToCallList}
                >
                  {isAddingToCallList ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PhoneCall className="h-4 w-4 mr-2" />
                  )}
                  Add to Call List
                </Button>
              </div>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedCompanies.size === companies.length}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCompanies.has(index)}
                          onCheckedChange={() => toggleCompany(index)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{company.company_name}</TableCell>
                      <TableCell>{company.phone_number}</TableCell>
                      <TableCell>{company.contact_person_name || '-'}</TableCell>
                      <TableCell>{company.industry || '-'}</TableCell>
                      <TableCell>
                        {[company.area, company.city].filter(Boolean).join(', ') || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!isLoading && companies.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Enter a business directory URL to extract company data</p>
            <p className="text-sm mt-1">
              Works with Yellow Pages, business directories, and company listing pages
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
