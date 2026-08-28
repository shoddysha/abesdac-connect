import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/types/database';
import { logAudit } from './audit';

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
  
  // Log audit
  await logAudit(
    'create',
    'announcements',
    `Announcement created: ${data.title}${data.is_pinned ? ' (Broadcast)' : ''}`,
    data.id,
    (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
  
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
  
  // Log audit
  let auditMessage = `Announcement updated: ${data.title}`;
  if (originalAnnouncement && !originalAnnouncement.is_pinned && payload.is_pinned) {
    auditMessage = `Announcement broadcast sent: ${data.title}`;
  }
  
  await logAudit(
    'update',
    'announcements',
    auditMessage,
    id,
    (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
  
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
  // Get announcement title for audit log
  const { data: announcement } = await supabase
    .from('announcements')
    .select('title')
    .eq('id', id)
    .single();
  
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
  
  // Log audit
  if (announcement) {
    await logAudit(
      'delete',
      'announcements',
      `Announcement deleted: ${announcement.title}`,
      id,
      (await supabase.auth.getUser()).data.user?.id,
      undefined
    );
  }
}
