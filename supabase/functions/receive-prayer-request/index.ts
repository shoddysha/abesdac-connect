// Supabase Edge Function to receive prayer requests via webhook from Google Forms
// This is a PUBLIC endpoint that Google Forms can POST to directly

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
    // Parse the incoming request body
    const body = await req.json();
    
    // Extract form data (adjust field names based on your Google Form)
    const {
      name,
      prayer_request,
      anonymous,
      timestamp, // Optional: Google Forms timestamp
    } = body;

    // Validation
    if (!name || !prayer_request) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: name and prayer_request' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this timestamp already exists (prevent duplicates)
    if (timestamp) {
      const { data: existing } = await supabase
        .from('prayer_requests')
        .select('id')
        .eq('google_form_timestamp', timestamp)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Prayer request already received',
            duplicate: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Determine if anonymous
    const isAnonymous = anonymous === 'Yes' || anonymous === 'yes' || anonymous === true;

    // Insert into database
    const { data, error } = await supabase
      .from('prayer_requests')
      .insert({
        requested_by: isAnonymous ? 'Anonymous' : name,
        request_text: prayer_request,
        is_anonymous: isAnonymous,
        status: 'open',
        google_form_timestamp: timestamp || null,
        member_id: null,
        created_by: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Prayer request received successfully',
        id: data.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing prayer request:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
