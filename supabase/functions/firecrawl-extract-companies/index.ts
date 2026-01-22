import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyData {
  company_name: string;
  phone_number: string;
  contact_person_name?: string;
  industry?: string;
  city?: string;
  area?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Extracting companies from:', formattedUrl);

    // Use Firecrawl with JSON extraction for structured company data
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: [
          {
            type: 'json',
            schema: {
              type: 'object',
              properties: {
                companies: {
                  type: 'array',
                  description: 'List of companies found on the page',
                  items: {
                    type: 'object',
                    properties: {
                      company_name: { type: 'string', description: 'The name of the company' },
                      phone_number: { type: 'string', description: 'Phone number with country code if available' },
                      contact_person_name: { type: 'string', description: 'Name of contact person if available' },
                      industry: { type: 'string', description: 'Industry or business type' },
                      city: { type: 'string', description: 'City location' },
                      area: { type: 'string', description: 'Area or district within the city' },
                    },
                    required: ['company_name', 'phone_number']
                  }
                }
              },
              required: ['companies']
            },
            prompt: 'Extract all company/business listings from this page. For each company, extract the company name, phone number (with country code if shown), contact person name, industry/business type, city, and area/district. Focus on business directory listings, company profiles, or contact information.'
          }
        ],
        onlyMainContent: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Failed to scrape page' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract companies from the response
    const extractedData = data.data?.json || data.json || {};
    const companies: CompanyData[] = extractedData.companies || [];

    console.log(`Extracted ${companies.length} companies`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        companies,
        sourceUrl: formattedUrl,
        metadata: data.data?.metadata || data.metadata
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting companies:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract companies';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
