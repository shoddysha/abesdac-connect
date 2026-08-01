import { supabase } from '@/lib/supabase';
import type { Ministry } from '@/types/database';

export async function fetchMinistries() {
  const { data, error } = await supabase
    .from('ministries')
    .select('*, profiles!ministries_leader_id_fkey(full_name)')
    .order('name');
  if (error) throw error;
  return data as (Ministry & { profiles: { full_name: string } | null })[];
}

// Returns a map of ministry_id -> number of members assigned to it,
// used by the Ministries page to show a member count on each card.
export async function fetchMinistryMemberCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('ministry_members').select('ministry_id');
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.ministry_id] = (counts[row.ministry_id] ?? 0) + 1;
  }
  return counts;
}

export async function createMinistry(payload: Partial<Ministry>) {
  const { data, error } = await supabase.from('ministries').insert(payload).select().single();
  if (error) throw error;
  return data as Ministry;
}

export async function updateMinistry(id: string, payload: Partial<Ministry>) {
  const { data, error } = await supabase.from('ministries').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data as Ministry;
}

export async function deleteMinistry(id: string) {
  const { error } = await supabase.from('ministries').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMinistryMembers(ministryId: string) {
  const { data, error } = await supabase
    .from('ministry_members')
    .select('id, joined_at, members(id, first_name, last_name, member_code, profile_image_url)')
    .eq('ministry_id', ministryId);
  if (error) throw error;
  return data;
}

export async function addMemberToMinistry(ministryId: string, memberId: string) {
  const { error } = await supabase.from('ministry_members').insert({ ministry_id: ministryId, member_id: memberId });
  if (error) throw error;
}

export async function removeMemberFromMinistry(ministryMemberRowId: string) {
  const { error } = await supabase.from('ministry_members').delete().eq('id', ministryMemberRowId);
  if (error) throw error;
}
