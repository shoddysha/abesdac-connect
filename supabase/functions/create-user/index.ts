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
    // ── 1. Verify the caller is an authenticated administrator ──────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use anon client with the caller's JWT to verify their role
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check the caller's role in the profiles table
    const { data: callerProfile, error: profileError } = await anonClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'administrator') {
      return new Response(JSON.stringify({ error: 'Only administrators can create users' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Parse and validate the request body ──────────────────────────────
    const { email, password, full_name, phone, role } = await req.json();

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, full_name, role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validRoles = ['administrator', 'secretary', 'pastor', 'ministry_leader'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Create the user using the service role key (admin API) ───────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,           // pre-confirm so they can log in immediately
      user_metadata: { full_name, role },
    });

    if (createError) {
      // Log the full error details for debugging
      console.error('createUser error:', JSON.stringify(createError));

      const isDuplicate =
        createError.message.toLowerCase().includes('already registered') ||
        createError.message.toLowerCase().includes('already exists') ||
        createError.message.toLowerCase().includes('duplicate');

      return new Response(
        JSON.stringify({
          error: isDuplicate
            ? 'A user with that email address already exists.'
            : createError.message,
          // Return full error details so the frontend can show them
          detail: createError,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      return new Response(JSON.stringify({ error: 'User creation failed — no user returned' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Upsert the profile row with the correct role ─────────────────────
    const { error: profileUpsertError } = await adminClient
      .from('profiles')
      .upsert({
        id:         newUser.user.id,
        email:      email.toLowerCase().trim(),
        full_name,
        phone:      phone || null,
        role,
        is_active:  true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileUpsertError) {
      // User was created in auth but profile failed — still return success
      // since the auth trigger may have already created the profile row
      console.error('Profile upsert error:', profileUpsertError.message);
    }

    // ── 5. Return success ───────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success:  true,
        user_id:  newUser.user.id,
        email:    newUser.user.email,
        full_name,
        role,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('create-user error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
