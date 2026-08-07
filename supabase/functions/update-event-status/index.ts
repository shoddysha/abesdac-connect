// Supabase Edge Function to automatically update event statuses
// Runs on schedule via cron job
// - Changes status to 'ongoing' when event start time is reached
// - Changes status to 'completed' 48 hours after event start time

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
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    let updatedOngoing = 0;
    let updatedCompleted = 0;

    // 1. Update events to 'ongoing' when start time is reached
    const { data: toOngoing, error: ongoingError } = await supabase
      .from('events')
      .update({ status: 'ongoing' })
      .eq('status', 'upcoming')
      .lte('start_time', now)
      .select();

    if (ongoingError) {
      console.error('Error updating to ongoing:', ongoingError);
    } else {
      updatedOngoing = toOngoing?.length || 0;
      console.log(`Updated ${updatedOngoing} event(s) to ongoing`);
    }

    // 2. Update events to 'completed' 48 hours after start time
    const { data: toCompleted, error: completedError } = await supabase
      .from('events')
      .update({ status: 'completed' })
      .in('status', ['upcoming', 'ongoing'])
      .lte('start_time', fortyEightHoursAgo)
      .select();

    if (completedError) {
      console.error('Error updating to completed:', completedError);
    } else {
      updatedCompleted = toCompleted?.length || 0;
      console.log(`Updated ${updatedCompleted} event(s) to completed`);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Event statuses updated successfully',
        updatedOngoing,
        updatedCompleted,
        timestamp: now,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error updating event statuses:', error);
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
