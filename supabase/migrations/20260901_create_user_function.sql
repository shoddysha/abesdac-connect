-- ============================================================
-- ABESDAC Connect — create_new_user function
-- PASTE THIS ENTIRE SCRIPT into Supabase SQL Editor and Run
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Step 1: Drop any broken old version
DROP FUNCTION IF EXISTS create_new_user(text, text, text, text, text);

-- Step 2: Create the function
CREATE FUNCTION create_new_user(
  p_email     TEXT,
  p_password  TEXT,
  p_full_name TEXT,
  p_phone     TEXT DEFAULT NULL,
  p_role      TEXT DEFAULT 'ministry_leader'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id            UUID := gen_random_uuid();
  v_encrypted_password TEXT := crypt(p_password, gen_salt('bf'));
BEGIN
  -- Guard: role must be valid
  IF p_role NOT IN ('administrator','secretary','pastor','ministry_leader','member') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Guard: email must be unique
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'A user with email % already exists', p_email;
  END IF;

  -- Create the auth user (pre-confirmed so they can log in right away)
  INSERT INTO auth.users (
    id, instance_id,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role,
    created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    v_encrypted_password,
    now(),
    jsonb_build_object('provider','email','providers',ARRAY['email']),
    jsonb_build_object('full_name', p_full_name),
    'authenticated', 'authenticated',
    now(), now(),
    '', '', '', ''
  );

  -- Create the profile row
  INSERT INTO public.profiles (
    id, email, full_name, phone, role, is_active, created_at, updated_at
  ) VALUES (
    v_user_id,
    lower(trim(p_email)),
    p_full_name,
    p_phone,
    p_role,
    true,
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = EXCLUDED.full_name,
    phone      = EXCLUDED.phone,
    role       = EXCLUDED.role,
    is_active  = true,
    updated_at = now();

  RETURN json_build_object(
    'success',   true,
    'user_id',   v_user_id,
    'email',     p_email,
    'full_name', p_full_name,
    'role',      p_role
  );
END;
$$;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION create_new_user(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_new_user(TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
