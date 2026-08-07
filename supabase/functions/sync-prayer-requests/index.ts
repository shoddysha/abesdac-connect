// Supabase Edge Function to sync prayer requests from Google Sheets
// Deploy with: supabase functions deploy sync-prayer-requests

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    const GOOGLE_SHEET_ID = Deno.env.get('PRAYER_REQUESTS_SHEET_ID');
    
    if (!GOOGLE_SHEETS_API_KEY || !GOOGLE_SHEET_ID) {
      throw new Error('Missing Google Sheets configuration. Please set GOOGLE_SHEETS_API_KEY and PRAYER_REQUESTS_SHEET_ID in Supabase Edge Function secrets.');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch data from Google Sheets
    // Sheet range: Adjust this to match your Google Form response columns
    // Expected columns: Timestamp, Name, Prayer Request, Anonymous (Yes/No)
    const sheetRange = 'Form Responses 1!A:D'; // Adjust range as needed
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${sheetRange}?key=${GOOGLE_SHEETS_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length <= 1) {
      // No data rows (only header)
      return new Response(
        JSON.stringify({ success: true, newCount: 0, message: 'No new responses' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip header row
    const [header, ...dataRows] = rows;
    let newCount = 0;

    // Process each row
    for (const row of dataRows) {
      const [timestamp, name, prayerRequest, anonymous] = row;

      // Skip empty rows
      if (!timestamp || !name || !prayerRequest) continue;

      // Check if this timestamp already exists (avoid duplicates)
      const { data: existing } = await supabase
        .from('prayer_requests')
        .select('id')
        .eq('google_form_timestamp', timestamp)
        .single();

      if (existing) {
        // Already imported
        continue;
      }

      // Determine if anonymous
      const isAnonymous = anonymous?.toLowerCase() === 'yes';

      // Insert new prayer request
      const { error: insertError } = await supabase
        .from('prayer_requests')
        .insert({
          requested_by: isAnonymous ? 'Anonymous' : name,
          request_text: prayerRequest,
          is_anonymous: isAnonymous,
          status: 'open',
          google_form_timestamp: timestamp,
          member_id: null,
          created_by: null,
        });

      if (insertError) {
        console.error('Error inserting prayer request:', insertError);
        continue;
      }

      newCount++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        newCount, 
        message: `Successfully imported ${newCount} new prayer request(s)` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing prayer requests:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
