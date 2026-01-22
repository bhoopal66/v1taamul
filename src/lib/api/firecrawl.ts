import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

type ScrapeOptions = {
  formats?: (
    | 'markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'branding' | 'summary'
    | { type: 'json'; schema?: object; prompt?: string }
  )[];
  onlyMainContent?: boolean;
  waitFor?: number;
  location?: { country?: string; languages?: string[] };
};

export interface ExtractedCompany {
  company_name: string;
  phone_number: string;
  contact_person_name?: string;
  industry?: string;
  city?: string;
  area?: string;
}

export interface ExtractCompaniesResponse {
  success: boolean;
  error?: string;
  companies?: ExtractedCompany[];
  sourceUrl?: string;
  metadata?: any;
}

export const firecrawlApi = {
  // Scrape a single URL
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Extract company data from a business directory page
  async extractCompanies(url: string): Promise<ExtractCompaniesResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-extract-companies', {
      body: { url },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};
