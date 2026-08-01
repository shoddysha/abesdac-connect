import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';

export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return data as Profile[];
}

export async function updateProfileRole(id: string, role: UserRole) {
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select().single();
  if (error) throw error;
  return data as Profile;
}

export async function setProfileActive(id: string, isActive: boolean) {
  const { data, error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id).select().single();
  if (error) throw error;
  return data as Profile;
}

/**
 * Creates a new team member account.
 * IMPORTANT: creating auth users normally requires the Supabase service-role
 * key, which must never be shipped to the browser. Since this app is
 * frontend-only, new accounts are created via self sign-up:
 * send the person the app URL, have them use "Forgot password" with their
 * assigned email after an administrator pre-creates their profile row,
 * OR simplest for a beginner project: have the administrator create the
 * user directly from Supabase Studio → Authentication → Users → "Add user",
 * which auto-creates the matching profiles row via the on_auth_user_created
 * trigger. See README → "Adding new users" for the exact steps.
 */
export async function updateProfileDetails(id: string, payload: Partial<Profile>) {
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data as Profile;
}
