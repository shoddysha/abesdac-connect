import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ARKESEL_API_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const ARKESEL_API_KEY = Deno.env.get('ARKESEL_API_KEY')!;
const ARKESEL_SENDER_ID = Deno.env.get('ARKESEL_SENDER_ID') || 'AbekaSDAChu';

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
    // Get JWT from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is admin or secretary
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['administrator', 'secretary'].includes(profile.role)) {
      throw new Error('Insufficient permissions - only administrators and secretaries can send SMS');
    }

    // Get request body
    const { recipients, message } = await req.json();

    // Validate input
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients array is required and must not be empty');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Message is required and must not be empty');
    }

    // Validate Arkesel API key is configured
    if (!ARKESEL_API_KEY) {
      throw new Error('Arkesel API key is not configured in Edge Function secrets');
    }

    console.log(`Sending SMS to ${recipients.length} recipients`);

    // Call Arkesel API
    const arkeselResponse = await fetch(ARKESEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': ARKESEL_API_KEY,
      },
      body: JSON.stringify({
        sender: ARKESEL_SENDER_ID,
        message: message,
        recipients: recipients,
      }),
    });

    const arkeselData = await arkeselResponse.json();

    if (!arkeselResponse.ok) {
      console.error('Arkesel API error:', arkeselData);
      throw new Error(`Arkesel API error: ${arkeselResponse.status} - ${JSON.stringify(arkeselData)}`);
    }

    console.log('SMS sent successfully:', arkeselData);

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
    console.error('Error in send-sms function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
