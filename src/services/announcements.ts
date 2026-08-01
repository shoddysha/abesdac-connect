import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/types/database';

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data as Announcement[];
}

export async function createAnnouncement(payload: Partial<Announcement>) {
  const { data, error } = await supabase.from('announcements').insert(payload).select().single();
  if (error) throw error;
  return data as Announcement;
}

export async function updateAnnouncement(id: string, payload: Partial<Announcement>) {
  const { data, error } = await supabase.from('announcements').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data as Announcement;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
