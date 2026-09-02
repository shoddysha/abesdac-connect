import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ARKESEL_BALANCE_URL = 'https://sms.arkesel.com/api/v2/clients/balance-details';
const ARKESEL_API_KEY = Deno.env.get('ARKESEL_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Validate Arkesel API key is configured
    if (!ARKESEL_API_KEY) {
      throw new Error('Arkesel API key is not configured in Edge Function secrets');
    }

    console.log('Fetching SMS balance from Arkesel');

    // Call Arkesel Balance API
    const arkeselResponse = await fetch(ARKESEL_BALANCE_URL, {
      method: 'GET',
      headers: {
        'api-key': ARKESEL_API_KEY,
      },
    });

    const arkeselData = await arkeselResponse.json();

    if (!arkeselResponse.ok) {
      console.error('Arkesel API error:', arkeselData);
      throw new Error(`Arkesel API error: ${arkeselResponse.status} - ${JSON.stringify(arkeselData)}`);
    }

    console.log('Balance fetched successfully:', arkeselData);

    return new Response(
      JSON.stringify({
        success: true,
        data: arkeselData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching balance:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
