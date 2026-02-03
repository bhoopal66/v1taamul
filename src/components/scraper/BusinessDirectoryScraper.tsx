import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, RefreshCw, PhoneCall, X } from 'lucide-react';
import { firecrawlApi, ExtractedCompany } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { DirectoryPresets } from './DirectoryPresets';

interface ExtractedCompanyWithStatus extends ExtractedCompany {
  isExisting?: boolean;
  existingContactId?: string;
}

export const BusinessDirectoryScraper = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  
  const [isAddingToCallList, setIsAddingToCallList] = useState(false);
  const [companies, setCompanies] = useState<ExtractedCompanyWithStatus[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [sourceUrl, setSourceUrl] = useState<string>('');

  const checkDuplicates = async (extractedCompanies: ExtractedCompany[]): Promise<ExtractedCompanyWithStatus[]> => {
    const companiesWithStatus: ExtractedCompanyWithStatus[] = [];
    
    for (const company of extractedCompanies) {
      const normalizedPhone = normalizePhoneNumber(company.phone_number);
      let isExisting = false;
      let existingContactId: string | undefined;
      
      try {
        // Check using RPC for cross-agent lookup
        const { data: existingId } = await supabase
          .rpc('find_contact_by_phone', { phone: normalizedPhone });
        
        if (existingId) {
          isExisting = true;
          existingContactId = existingId;
        } else {
          // Fallback: direct query
          const { data: existing } = await supabase
            .from('master_contacts')
            .select('id')
            .eq('phone_number', normalizedPhone)
            .maybeSingle();
          
          if (existing) {
            isExisting = true;
            existingContactId = existing.id;
          }
        }
      } catch (err) {
        console.error('Duplicate check error:', err);
      }
      
      companiesWithStatus.push({
        ...company,
        isExisting,
        existingContactId,
      });
    }
    
    return companiesWithStatus;
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setCompanies([]);
    setSelectedCompanies(new Set());

    try {
      const response = await firecrawlApi.extractCompanies(url);

      if (response.success && response.companies && response.companies.length > 0) {
        setSourceUrl(response.sourceUrl || url);
        
        // Check for duplicates in database
        setIsCheckingDuplicates(true);
        const companiesWithStatus = await checkDuplicates(response.companies);
        setCompanies(companiesWithStatus);
        setIsCheckingDuplicates(false);
        
        // Auto-select only new entries
        const newEntryIndices = companiesWithStatus
          .map((c, i) => (!c.isExisting ? i : -1))
          .filter(i => i !== -1);
        setSelectedCompanies(new Set(newEntryIndices));
        
        const existingCount = companiesWithStatus.filter(c => c.isExisting).length;
        const newCount = companiesWithStatus.length - existingCount;
        
        toast({
          title: 'Extraction Complete',
          description: `Found ${response.companies.length} companies (${newCount} new, ${existingCount} existing)`,
        });
      } else if (response.success && (!response.companies || response.companies.length === 0)) {
        toast({
          title: 'No Companies Found',
          description: 'The page was scraped but no company data was extracted. Try a different category page.',
          variant: 'default',
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
      setIsCheckingDuplicates(false);
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

  // Normalize UAE phone numbers: convert +971 or 971 prefix to 0
  const normalizePhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^00/, '+');
    
    if (cleaned.startsWith('+971')) {
      cleaned = '0' + cleaned.substring(4);
    } else if (cleaned.startsWith('971') && cleaned.length >= 12) {
      cleaned = '0' + cleaned.substring(3);
    }
    
    return cleaned;
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
        // Normalize the phone number before processing
        const normalizedPhone = normalizePhoneNumber(company.phone_number);
        // Check if phone number already exists using RPC (bypasses RLS for cross-agent check)
        let contactId: string | null = null;
        
        const { data: existingContactId, error: rpcError } = await supabase
          .rpc('find_contact_by_phone', { phone: normalizedPhone });

        if (!rpcError && existingContactId) {
          contactId = existingContactId;
        } else {
          // Fallback: direct query if RPC fails
          const { data: existing } = await supabase
            .from('master_contacts')
            .select('id')
            .eq('phone_number', normalizedPhone)
            .maybeSingle();

          if (existing) {
            contactId = existing.id;
          }
        }

        if (!contactId) {
          // Insert new contact with normalized phone
          const { data: newContact, error: insertError } = await supabase
            .from('master_contacts')
            .insert({
              company_name: company.company_name,
              phone_number: normalizedPhone,
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

  const handleClear = () => {
    setCompanies([]);
    setSelectedCompanies(new Set());
    setSourceUrl('');
    setUrl('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Data Collector
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
          <Button type="submit" disabled={isLoading || isCheckingDuplicates || !url.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : isCheckingDuplicates ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking duplicates...
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {selectedCompanies.size} of {companies.length} selected
                </Badge>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  {companies.filter(c => !c.isExisting).length} new
                </Badge>
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  {companies.filter(c => c.isExisting).length} existing
                </Badge>
                {sourceUrl && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    from: {sourceUrl}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddToCallList}
                  disabled={selectedCompanies.size === 0 || isAddingToCallList}
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
                    <TableHead>Status</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company, index) => (
                    <TableRow key={index} className={company.isExisting ? 'bg-orange-50 dark:bg-orange-950/20' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCompanies.has(index)}
                          onCheckedChange={() => toggleCompany(index)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{company.company_name}</TableCell>
                      <TableCell>{company.phone_number}</TableCell>
                      <TableCell>
                        {company.isExisting ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                            Existing
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                            New
                          </Badge>
                        )}
                      </TableCell>
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
          <div className="space-y-6">
            <DirectoryPresets 
              onSelectDirectory={(directoryUrl) => setUrl(directoryUrl)} 
              disabled={isLoading}
            />
            <div className="text-center py-6 text-muted-foreground border-t">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Select a directory above or enter a custom URL</p>
              <p className="text-sm mt-1">
                Navigate to a category/listing page for best results
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
