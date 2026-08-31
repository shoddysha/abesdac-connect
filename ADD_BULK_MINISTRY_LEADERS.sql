-- =====================================================================
-- Bulk Create Ministry Leaders (10 users at once)
-- =====================================================================
-- INSTRUCTIONS:
-- 1. Edit the data in the temp table below with your leaders' info
-- 2. Run this entire script in Supabase SQL Editor
-- 3. All 10 leaders will be created at once
-- =====================================================================

do $$
declare
  leader record;
  new_user_id uuid;
begin
  -- Temporary table with all your ministry leaders
  create temp table temp_leaders (
    email text,
    password text,
    full_name text,
    ministry_name text  -- The ministry they will lead
  );

  -- ============= TEMP LOG INS =============
  insert into temp_leaders (email, password, full_name, ministry_name) values
    ('youth@gmail.com', 'Abeka123', 'Decoan', 'Decoan Department'),
    ('womens@gmail.com', 'Abeka123', 'Women', 'Adventist Women Ministry (AWM)'),
    ('mens@gmail.com', 'Abeka123', 'Men', 'Adventist Men Ministry (AMM)'),
    ('personal@gmail.com', 'Abeka123', 'Personal', 'Personal Ministries'),
    ('children@gmail.com', 'Abeka123', 'Children', 'Children Ministry'),
    ('music@gmail.com', 'Abeka123', 'Music', 'Music Department'),
    ('health@gmail.com', 'Abeka123', 'Health', 'Adventist Health Ministry'),
    ('finance@gmail.com', 'Abeka123', 'Finance', 'Church Finance Committee');
  -- ============= END OF DATA =============

  -- Loop through each leader and create them
  for leader in select * from temp_leaders loop
    new_user_id := gen_random_uuid();
    
    -- Create auth user
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change, email_change_token_new,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      leader.email,
      crypt(leader.password, gen_salt('bf')),
      now(), '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', leader.full_name),
      now(), now(), now()
    );

    -- Create identity
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', leader.email),
      'email',
      new_user_id::text,
      now(), now(), now()
    );

    -- Update profile with role and full name
    update public.profiles 
    set 
      role = 'ministry_leader',
      full_name = leader.full_name,
      is_active = true
    where id = new_user_id;

    -- Assign as leader to their ministry (if ministry exists)
    update public.ministries 
    set leader_id = new_user_id 
    where name = leader.ministry_name;
    
    raise notice 'Created: % (%) - Assigned to: %', 
      leader.full_name, leader.email, leader.ministry_name;
  end loop;

  drop table temp_leaders;
  
  raise notice '========================================';
  raise notice 'Successfully created all ministry leaders!';
  raise notice '========================================';
end $$;


-- =====================================================================
-- View All Ministry Leaders
-- =====================================================================
SELECT 
  p.full_name,
  p.email,
  p.phone,
  p.role,
  m.name as ministry,
  p.is_active,
  p.created_at
FROM public.profiles p
LEFT JOIN public.ministries m ON m.leader_id = p.id
WHERE p.role = 'ministry_leader'
ORDER BY p.created_at DESC;
