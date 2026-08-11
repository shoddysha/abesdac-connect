import { supabase } from '@/lib/supabase';

export type LeadershipRole = 
  | 'main_leader' 
  | 'deputy' 
  | 'secretary' 
  | 'treasurer' 
  | 'coordinator'
  | 'assistant'
  | 'other';

export interface MinistryLeader {
  id: string;
  ministry_id: string;
  ministry_name: string;
  member_id: string;
  member_name: string;
  member_code: string;
  member_phone: string | null;
  member_email: string | null;
  leadership_role: LeadershipRole;
  portfolio: string | null;
  bio: string | null;
  appointed_date: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateMinistryLeaderInput {
  ministry_id: string;
  member_id: string;
  leadership_role: LeadershipRole;
  portfolio?: string;
  bio?: string;
  appointed_date?: string;
}

export interface UpdateMinistryLeaderInput {
  leadership_role?: LeadershipRole;
  portfolio?: string;
  bio?: string;
  is_active?: boolean;
}

/**
 * Sync main leaders from ministries table
 * Creates ministry_leaders records for any ministry.leader_id that doesn't exist yet
 */
export async function syncMainLeadersFromMinistries(): Promise<void> {
  // Get all ministries with a leader_id
  const { data: ministries, error: ministriesError } = await supabase
    .from('ministries')
    .select('id, leader_id, members!inner(id)')
    .not('leader_id', 'is', null);

  if (ministriesError) throw ministriesError;

  // Get existing main_leader records
  const { data: existingLeaders, error: leadersError } = await supabase
    .from('ministry_leaders')
    .select('ministry_id, member_id')
    .eq('leadership_role', 'main_leader');

  if (leadersError) throw leadersError;

  const existingMap = new Set(
    (existingLeaders || []).map((l) => `${l.ministry_id}:${l.member_id}`)
  );

  // Find ministries that need a main_leader record
  const toCreate = (ministries || [])
    .filter((m: any) => {
      // Find member with this leader_id
      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', m.leader_id)
        .single();
      
      if (!member) return false;
      
      const key = `${m.id}:${member.id}`;
      return !existingMap.has(key);
    });

  // This approach won't work with await in filter, let me fix it
}

/**
 * Fetch all ministry leaders across all ministries
 */
export async function fetchAllMinistryLeaders(): Promise<MinistryLeader[]> {
  const { data, error } = await supabase
    .from('ministry_leaders')
    .select(`
      *,
      ministries(name),
      members(
        first_name,
        last_name,
        member_code,
        phone,
        email
      )
    `)
    .eq('is_active', true)
    .order('ministry_id')
    .order('leadership_role');

  if (error) throw error;

  return (data || []).map((leader: any) => ({
    id: leader.id,
    ministry_id: leader.ministry_id,
    ministry_name: leader.ministries?.name || 'Unknown Ministry',
    member_id: leader.member_id,
    member_name: `${leader.members?.first_name} ${leader.members?.last_name}`,
    member_code: leader.members?.member_code,
    member_phone: leader.members?.phone,
    member_email: leader.members?.email,
    leadership_role: leader.leadership_role,
    portfolio: leader.portfolio,
    bio: leader.bio,
    appointed_date: leader.appointed_date,
    is_active: leader.is_active,
    created_at: leader.created_at,
  }));
}

/**
 * Fetch leaders for a specific ministry
 */
export async function fetchMinistryLeaders(ministryId: string): Promise<MinistryLeader[]> {
  const { data, error } = await supabase
    .from('ministry_leaders')
    .select(`
      *,
      ministries(name),
      members(
        first_name,
        last_name,
        member_code,
        phone,
        email
      )
    `)
    .eq('ministry_id', ministryId)
    .eq('is_active', true)
    .order('leadership_role');

  if (error) throw error;

  return (data || []).map((leader: any) => ({
    id: leader.id,
    ministry_id: leader.ministry_id,
    ministry_name: leader.ministries?.name || 'Unknown Ministry',
    member_id: leader.member_id,
    member_name: `${leader.members?.first_name} ${leader.members?.last_name}`,
    member_code: leader.members?.member_code,
    member_phone: leader.members?.phone,
    member_email: leader.members?.email,
    leadership_role: leader.leadership_role,
    portfolio: leader.portfolio,
    bio: leader.bio,
    appointed_date: leader.appointed_date,
    is_active: leader.is_active,
    created_at: leader.created_at,
  }));
}

/**
 * Add a new leader to a ministry
 */
export async function createMinistryLeader(input: CreateMinistryLeaderInput): Promise<MinistryLeader> {
  const { data, error } = await supabase
    .from('ministry_leaders')
    .insert({
      ministry_id: input.ministry_id,
      member_id: input.member_id,
      leadership_role: input.leadership_role,
      portfolio: input.portfolio || null,
      bio: input.bio || null,
      appointed_date: input.appointed_date || new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) throw error;
  
  // Fetch full details
  const leaders = await fetchMinistryLeaders(input.ministry_id);
  return leaders.find(l => l.id === data.id)!;
}

/**
 * Update a ministry leader's details
 */
export async function updateMinistryLeader(
  id: string,
  updates: UpdateMinistryLeaderInput
): Promise<void> {
  const { error } = await supabase
    .from('ministry_leaders')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

/**
 * Remove a leader from a ministry (soft delete - sets is_active to false)
 */
export async function removeMinistryLeader(id: string): Promise<void> {
  const { error } = await supabase
    .from('ministry_leaders')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Permanently delete a ministry leader record
 */
export async function deleteMinistryLeader(id: string): Promise<void> {
  const { error } = await supabase
    .from('ministry_leaders')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Export all ministry leaders to CSV
 */
export async function exportMinistryLeaders(leaders: MinistryLeader[]): Promise<void> {
  const headers = [
    'Ministry',
    'Name',
    'Member Code',
    'Leadership Role',
    'Portfolio',
    'Phone',
    'Email',
    'Appointed Date',
    'Bio',
  ];
  
  const roleLabels: Record<LeadershipRole, string> = {
    main_leader: 'Main Leader',
    deputy: 'Deputy Leader',
    secretary: 'Secretary',
    treasurer: 'Treasurer',
    coordinator: 'Coordinator',
    assistant: 'Assistant',
    other: 'Other',
  };

  const rows = leaders.map((l) => [
    l.ministry_name,
    l.member_name,
    l.member_code,
    roleLabels[l.leadership_role] || l.leadership_role,
    l.portfolio || '',
    l.member_phone || '',
    l.member_email || '',
    new Date(l.appointed_date).toLocaleDateString(),
    (l.bio || '').replace(/\n/g, ' '),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ministry-leaders-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Get leadership role display label
 */
export function getLeadershipRoleLabel(role: LeadershipRole): string {
  const labels: Record<LeadershipRole, string> = {
    main_leader: 'Main Leader',
    deputy: 'Deputy Leader',
    secretary: 'Secretary',
    treasurer: 'Treasurer',
    coordinator: 'Coordinator',
    assistant: 'Assistant',
    other: 'Other',
  };
  return labels[role] || role;
}
