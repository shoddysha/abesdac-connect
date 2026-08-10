import { supabase } from '@/lib/supabase';

export type LeaderPostType = 'announcement' | 'task' | 'note';
export type LeaderPostStatus = 'pending' | 'in_progress' | 'completed';

export interface LeaderPost {
  id: string;
  title: string;
  content: string;
  post_type: LeaderPostType;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  status: LeaderPostStatus;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeaderPostInput {
  title: string;
  content: string;
  post_type: LeaderPostType;
  assigned_to?: string | null;
  status?: LeaderPostStatus;
}

export interface UpdateLeaderPostInput {
  title?: string;
  content?: string;
  post_type?: LeaderPostType;
  assigned_to?: string | null;
  status?: LeaderPostStatus;
}

export async function fetchLeaderPosts(): Promise<LeaderPost[]> {
  const { data, error } = await supabase
    .from('leader_posts')
    .select(`
      *,
      assigned_to_profile:profiles!leader_posts_assigned_to_fkey(full_name),
      created_by_profile:profiles!leader_posts_created_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((post: any) => ({
    ...post,
    assigned_to_name: post.assigned_to_profile?.full_name,
    created_by_name: post.created_by_profile?.full_name,
  }));
}

export async function createLeaderPost(input: CreateLeaderPostInput): Promise<LeaderPost> {
  const { data, error } = await supabase
    .from('leader_posts')
    .insert({
      title: input.title,
      content: input.content,
      post_type: input.post_type,
      assigned_to: input.assigned_to ?? null,
      status: input.status ?? 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLeaderPost(
  id: string,
  updates: UpdateLeaderPostInput
): Promise<void> {
  const { error } = await supabase
    .from('leader_posts')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteLeaderPost(id: string): Promise<void> {
  const { error } = await supabase
    .from('leader_posts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function exportLeaderPosts(posts: LeaderPost[]): Promise<void> {
  // Simple CSV export
  const headers = ['Title', 'Type', 'Status', 'Content', 'Assigned To', 'Created By', 'Date'];
  const rows = posts.map((p) => [
    p.title,
    p.post_type,
    p.status,
    p.content.replace(/\n/g, ' '),
    p.assigned_to_name || '',
    p.created_by_name || '',
    new Date(p.created_at).toLocaleDateString(),
  ]);

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leaders-posts-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
