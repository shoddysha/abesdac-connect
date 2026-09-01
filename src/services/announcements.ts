import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/types/database';
import { logAudit } from './audit';

export interface AnnouncementView {
  id: string;
  announcement_id: string;
  user_id: string;
  viewed_at: string;
  created_at: string;
}

export interface AnnouncementWithViews extends Announcement {
  has_viewed?: boolean;
  view_count?: number;
}

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data as Announcement[];
}

/**
 * Fetch announcements with view status for current user
 */
export async function fetchAnnouncementsWithViewStatus(): Promise<AnnouncementWithViews[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });

  if (error) throw error;

  // Get user's viewed announcements
  const { data: views } = await supabase
    .from('announcement_views')
    .select('announcement_id')
    .eq('user_id', user.id);

  const viewedIds = new Set(views?.map(v => v.announcement_id) || []);

  return (data || []).map(announcement => ({
    ...announcement,
    has_viewed: viewedIds.has(announcement.id),
  }));
}

/**
 * Mark an announcement as viewed by current user
 */
export async function markAnnouncementAsViewed(announcementId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get announcement title for audit log
  const { data: announcement } = await supabase
    .from('announcements')
    .select('title')
    .eq('id', announcementId)
    .single();

  // Insert view record (unique constraint prevents duplicates)
  const { error } = await supabase
    .from('announcement_views')
    .insert({
      announcement_id: announcementId,
      user_id: user.id,
    });

  // Ignore unique constraint violation (user already viewed)
  if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
    throw error;
  }

  // Log audit (only if successfully inserted, not if duplicate)
  if (!error && announcement) {
    await logAudit(
      'create',
      'announcement_views',
      `Viewed announcement: ${announcement.title}`,
      announcementId,
      user.id,
      undefined
    );
  }
}

/**
 * Get view count and viewer list for an announcement (admin/secretary only)
 */
export async function getAnnouncementViews(announcementId: string) {
  const { data, error } = await supabase
    .from('announcement_views')
    .select(`
      id,
      viewed_at,
      profiles:user_id(
        id,
        full_name,
        email
      )
    `)
    .eq('announcement_id', announcementId)
    .order('viewed_at', { ascending: false });

  if (error) throw error;

  return {
    count: data?.length || 0,
    views: data || [],
  };
}

/**
 * Get unviewed announcement count for current user
 */
export async function getUnviewedAnnouncementCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get recent active announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id')
    .gte('published_at', thirtyDaysAgo.toISOString())
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

  if (!announcements || announcements.length === 0) return 0;

  const announcementIds = announcements.map(a => a.id);

  // Get viewed announcements
  const { data: views } = await supabase
    .from('announcement_views')
    .select('announcement_id')
    .eq('user_id', user.id)
    .in('announcement_id', announcementIds);

  const viewedIds = new Set(views?.map(v => v.announcement_id) || []);
  
  // Count unviewed
  return announcementIds.filter(id => !viewedIds.has(id)).length;
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
  
  // If announcement is pinned (broadcast), send SMS to all active members immediately
  if (data.is_pinned) {
    try {
      const { queueAnnouncementBroadcast, processPendingNotifications } = await import('./notifications');
      await queueAnnouncementBroadcast(
        data.id,
        data.title,
        data.content
      );
      // Process immediately (don't wait for scheduler)
      await processPendingNotifications();
    } catch (err) {
      console.error('Failed to send announcement broadcast:', err);
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
  
  // If announcement was just pinned (broadcast enabled), send SMS to all active members immediately
  if (originalAnnouncement && !originalAnnouncement.is_pinned && payload.is_pinned) {
    try {
      const { queueAnnouncementBroadcast, processPendingNotifications } = await import('./notifications');
      await queueAnnouncementBroadcast(
        data.id,
        data.title,
        data.content
      );
      // Process immediately (don't wait for scheduler)
      await processPendingNotifications();
    } catch (err) {
      console.error('Failed to send announcement broadcast:', err);
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