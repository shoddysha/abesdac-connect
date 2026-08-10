// Simple Edge Function to sync prayer requests from Google Sheets
// No webhooks, no Apps Script - just fetch from Google Sheets API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    const SHEET_ID = Deno.env.get('PRAYER_SHEET_ID');

    if (!API_KEY || !SHEET_ID) {
      throw new Error('Missing GOOGLE_SHEETS_API_KEY or PRAYER_SHEET_ID in Edge Function secrets');
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch from Google Sheets
    // Range: A:D means columns A through D (Timestamp, Name, Prayer Request, Anonymous)
    // "Form Responses 1" is the default tab name Google Forms creates
    const range = encodeURIComponent('Form Responses 1!A:D');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
    
    console.log('Fetching from Google Sheets...');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length <= 1) {
      // No data (only header row)
      return new Response(
        JSON.stringify({ success: true, newCount: 0, message: 'No responses in sheet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip header row
    const [_header, ...dataRows] = rows;
    let newCount = 0;

    console.log(`Found ${dataRows.length} total rows in sheet`);

    // Process each row
    for (const row of dataRows) {
      const [timestamp, name, prayerRequest, anonymous] = row;

      // Skip empty rows
      if (!timestamp || !name || !prayerRequest) {
        console.log('Skipping empty row');
        continue;
      }

      // Check if already imported (using timestamp as unique identifier)
      const { data: existing } = await supabase
        .from('prayer_requests')
        .select('id')
        .eq('google_form_timestamp', timestamp)
        .maybeSingle();

      if (existing) {
        console.log(`Skipping duplicate: ${timestamp}`);
        continue; // Already imported
      }

      // Check if this prayer was previously deleted (don't re-import)
      const { data: wasDeleted } = await supabase
        .from('deleted_prayer_timestamps')
        .select('id')
        .eq('google_form_timestamp', timestamp)
        .maybeSingle();

      if (wasDeleted) {
        console.log(`Skipping previously deleted prayer: ${timestamp}`);
        continue; // Was deleted, don't re-import
      }

      // Determine if anonymous
      const isAnonymous = anonymous?.toLowerCase() === 'yes';
      const displayName = isAnonymous ? 'Anonymous' : name;

      // Insert into database
      const { error: insertError } = await supabase
        .from('prayer_requests')
        .insert({
          requested_by: displayName,
          request_text: prayerRequest,
          is_anonymous: isAnonymous,
          status: 'open',
          google_form_timestamp: timestamp,
          member_id: null,
          created_by: null,
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        continue; // Skip this row but continue with others
      }

      newCount++;
      console.log(`Imported: ${displayName} - ${timestamp}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        newCount,
        totalRows: dataRows.length,
        message: `Successfully imported ${newCount} new prayer request(s)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
