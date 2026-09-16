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
  
  // Send new member welcome series immediately if phone number is provided and status is active
  if (data.phone && data.status === 'active') {
    try {
      const { queueNewMemberWelcomeSeries, processPendingNotifications } = await import('./notifications');
      // Queue the SMS series
      await queueNewMemberWelcomeSeries(
        data.id,
        data.first_name,
        data.last_name,
        data.phone,
        data.date_joined
      );
      // Process immediately (don't wait for scheduler)
      await processPendingNotifications();
    } catch (err) {
      console.error('Failed to send new member welcome series:', err);
      // Don't throw - member was created successfully
    }
  }
  
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

/**
 * Fetch all members belonging to a ministry, using BOTH linkage mechanisms:
 *  1. members.ministry_id (primary/direct FK assignment)
 *  2. ministry_members junction table (secondary memberships)
 * Members in either group are included; duplicates are removed.
 * Extra filters (search, status, gender) still apply.
 */
export async function fetchMembersForMinistry(
  ministryId: string,
  filters: Omit<MemberFilters, 'ministryId'> = {}
) {
  // Fetch primary members (ministry_id FK) and junction members in parallel
  const buildBase = () =>
    supabase
      .from('members')
      .select('*, ministries(name)')
      .eq('is_archived', filters.status === 'archived');

  let primaryQuery = buildBase().eq('ministry_id', ministryId);
  if (filters.status && filters.status !== 'archived') {
    primaryQuery = primaryQuery.eq('status', filters.status);
  }
  if (filters.gender) primaryQuery = primaryQuery.eq('gender', filters.gender);
  if (filters.search) {
    primaryQuery = primaryQuery.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,member_code.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }

  // Get member IDs from junction table
  const junctionQuery = supabase
    .from('ministry_members')
    .select('member_id')
    .eq('ministry_id', ministryId);

  const [primaryResult, junctionResult] = await Promise.all([primaryQuery, junctionQuery]);
  if (primaryResult.error) throw primaryResult.error;
  if (junctionResult.error) throw junctionResult.error;

  // Collect junction member IDs that aren't already in the primary set
  const primaryIds = new Set((primaryResult.data ?? []).map((m) => m.id));
  const extraIds = (junctionResult.data ?? [])
    .map((r) => r.member_id)
    .filter((id) => !primaryIds.has(id));

  let extraMembers: (Member & { ministries: { name: string } | null })[] = [];
  if (extraIds.length > 0) {
    let extraQuery = buildBase().in('id', extraIds);
    if (filters.status && filters.status !== 'archived') {
      extraQuery = extraQuery.eq('status', filters.status);
    }
    if (filters.gender) extraQuery = extraQuery.eq('gender', filters.gender);
    if (filters.search) {
      extraQuery = extraQuery.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,member_code.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      );
    }
    const extraResult = await extraQuery;
    if (extraResult.error) throw extraResult.error;
    extraMembers = (extraResult.data ?? []) as (Member & { ministries: { name: string } | null })[];
  }

  const combined = [...(primaryResult.data ?? []), ...extraMembers] as (Member & {
    ministries: { name: string } | null;
  })[];

  // Sort by last name to match fetchMembers behaviour
  combined.sort((a, b) => a.last_name.localeCompare(b.last_name));
  return combined;
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
