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
  
  // If announcement is pinned (broadcast), send SMS to all active members
  if (data.is_pinned) {
    try {
      const { queueAnnouncementBroadcast } = await import('./notifications');
      await queueAnnouncementBroadcast(
        data.id,
        data.title,
        data.content
      );
    } catch (err) {
      console.error('Failed to queue announcement broadcast:', err);
      // Don't throw - announcement was created successfully
    }
  }
  
  return data as Announcement;
}

export async function updateAnnouncement(id: string, payload: Partial<Announcement>) {
  // Get original announcement to check if is_pinned changed
  const { data: originalAnnouncement } = await supabase
    .from('announcements')
    .select('is_pinned, title, content')
    .eq('id', id)
    .single();
  
  const { data, error } = await supabase.from('announcements').update(payload).eq('id', id).select().single();
  if (error) throw error;
  
  // If announcement was just pinned (broadcast enabled), send SMS to all active members
  if (originalAnnouncement && !originalAnnouncement.is_pinned && payload.is_pinned) {
    try {
      const { queueAnnouncementBroadcast } = await import('./notifications');
      await queueAnnouncementBroadcast(
        data.id,
        data.title,
        data.content
      );
    } catch (err) {
      console.error('Failed to queue announcement broadcast:', err);
      // Don't throw - announcement update was successful
    }
  }
  
  return data as Announcement;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
