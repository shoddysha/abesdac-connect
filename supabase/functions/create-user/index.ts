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
    // ── 1. Verify caller is an authenticated administrator ──────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await anonClient
      .from('profiles').select('role').eq('id', caller.id).single();

    if (!callerProfile || callerProfile.role !== 'administrator') {
      return json({ error: 'Only administrators can create users' }, 403);
    }

    // ── 2. Validate input ───────────────────────────────────────────────────
    const { email, password, full_name, phone, role } = await req.json();

    if (!email || !password || !full_name || !role) {
      return json({ error: 'Missing required fields: email, password, full_name, role' }, 400);
    }

    const validRoles = ['administrator', 'secretary', 'pastor', 'ministry_leader'];
    if (!validRoles.includes(role)) {
      return json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, 400);
    }

    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();

    // ── 3. Use service-role client to run SQL directly ──────────────────────
    // auth.admin.createUser() can fail with a 500 on some Supabase versions.
    // We bypass it entirely and insert into auth.users directly via rpc,
    // using a SECURITY DEFINER function that runs as postgres superuser.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check for duplicate email first so we can give a clear message
    const { data: existing } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return json({ error: 'A user with that email address already exists.' }, 400);
    }

    // Call the create_new_user SQL function which inserts directly into
    // auth.users + auth.identities + profiles with full control
    const { data: rpcResult, error: rpcError } = await adminClient.rpc('create_new_user', {
      p_email:     cleanEmail,
      p_password:  password,
      p_full_name: full_name,
      p_phone:     phone || null,
      p_role:      role,
    });

    if (rpcError) {
      console.error('create_new_user rpc error:', JSON.stringify(rpcError));

      // Surface duplicate clearly
      if (rpcError.message?.toLowerCase().includes('already exists')) {
        return json({ error: 'A user with that email address already exists.' }, 400);
      }

      return json({ error: rpcError.message || 'Failed to create user' }, 500);
    }

    // rpcResult is null/{} when the SQL function ran but auth.users insert
    // was blocked — this means the DB function needs a fix (see migration)
    if (!rpcResult || (typeof rpcResult === 'object' && !rpcResult.user_id)) {
      console.error('create_new_user returned empty result:', JSON.stringify(rpcResult));
      return json({
        error: 'User creation failed. Please run the latest migration in your Supabase SQL Editor.',
      }, 500);
    }

    return json({
      success:   true,
      user_id:   rpcResult.user_id,
      email:     cleanEmail,
      full_name,
      role,
    }, 200);

  } catch (err) {
    console.error('create-user unhandled error:', err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
