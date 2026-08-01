import { supabase } from '@/lib/supabase';
import type { Member } from '@/types/database';

export interface MemberFilters {
  search?: string;
  status?: string;
  ministryId?: string;
  gender?: string;
}

export async function fetchMembers(filters: MemberFilters = {}) {
  let query = supabase
    .from('members')
    .select('*, ministries(name)')
    .eq('is_archived', filters.status === 'archived')
    .order('last_name', { ascending: true });

  if (filters.status && filters.status !== 'archived') {
    query = query.eq('status', filters.status);
  }
  if (filters.ministryId) query = query.eq('ministry_id', filters.ministryId);
  if (filters.gender) query = query.eq('gender', filters.gender);
  if (filters.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,member_code.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (Member & { ministries: { name: string } | null })[];
}

export async function fetchMember(id: string) {
  const { data, error } = await supabase.from('members').select('*, ministries(name)').eq('id', id).single();
  if (error) throw error;
  return data as Member & { ministries: { name: string } | null };
}

export async function createMember(payload: Partial<Member>) {
  const { data, error } = await supabase.from('members').insert(payload).select().single();
  if (error) throw error;
  return data as Member;
}

export async function updateMember(id: string, payload: Partial<Member>) {
  const { data, error } = await supabase.from('members').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data as Member;
}

export async function archiveMember(id: string) {
  return updateMember(id, { is_archived: true, status: 'archived' });
}

export async function restoreMember(id: string) {
  return updateMember(id, { is_archived: false, status: 'active' });
}

export async function deleteMember(id: string) {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkInsertMembers(payloads: Partial<Member>[]) {
  const { data, error } = await supabase.from('members').insert(payloads).select();
  if (error) throw error;
  return data as Member[];
}

export async function fetchMemberStats() {
  const { count: total } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('is_archived', false);
  const { count: active } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false)
    .eq('status', 'active');
  const { count: male } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false)
    .eq('gender', 'male');
  const { count: female } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false)
    .eq('gender', 'female');

  return {
    total: total ?? 0,
    active: active ?? 0,
    male: male ?? 0,
    female: female ?? 0,
  };
}
