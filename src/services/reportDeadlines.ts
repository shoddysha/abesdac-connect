import { supabase } from '@/lib/supabase';
import type { ReportDeadline, ReportDeadlineNotification, ReportType } from '@/types/database';

export interface ReportDeadlineWithDetails extends ReportDeadline {
  ministry_name?: string;
  creator_name?: string;
  unread_count?: number;
}

export interface ReportDeadlineNotificationWithDetails extends ReportDeadlineNotification {
  deadline?: ReportDeadline & { ministry_name?: string };
}

/**
 * Fetch all report deadlines (admin/secretary view)
 */
export async function fetchAllReportDeadlines(): Promise<ReportDeadlineWithDetails[]> {
  const { data, error } = await supabase
    .from('report_deadlines')
    .select(`
      *,
      ministries(name),
      creator:profiles!report_deadlines_created_by_fkey(full_name)
    `)
    .order('deadline_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((deadline: any) => ({
    ...deadline,
    ministry_name: deadline.ministries?.name,
    creator_name: deadline.creator?.full_name,
  }));
}

/**
 * Fetch report deadlines for a specific ministry
 */
export async function fetchMinistryDeadlines(ministryId: string): Promise<ReportDeadlineWithDetails[]> {
  const { data, error } = await supabase
    .from('report_deadlines')
    .select(`
      *,
      ministries(name),
      creator:profiles!report_deadlines_created_by_fkey(full_name)
    `)
    .eq('ministry_id', ministryId)
    .order('deadline_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((deadline: any) => ({
    ...deadline,
    ministry_name: deadline.ministries?.name,
    creator_name: deadline.creator?.full_name,
  }));
}

/**
 * Create a new report deadline
 */
export async function createReportDeadline(
  ministryId: string,
  reportType: ReportType,
  reportPeriod: string,
  deadlineDate: string,
  title: string,
  description?: string,
  createdBy?: string
): Promise<ReportDeadline> {
  const { data, error } = await supabase
    .from('report_deadlines')
    .insert({
      ministry_id: ministryId,
      report_type: reportType,
      report_period: reportPeriod,
      deadline_date: deadlineDate,
      title,
      description: description || null,
      created_by: createdBy || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ReportDeadline;
}

/**
 * Update a report deadline
 */
export async function updateReportDeadline(
  id: string,
  updates: Partial<ReportDeadline>
): Promise<void> {
  const { error } = await supabase
    .from('report_deadlines')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Delete a report deadline
 */
export async function deleteReportDeadline(id: string): Promise<void> {
  const { error } = await supabase
    .from('report_deadlines')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Fetch notifications for a specific leader (by profile_id)
 */
export async function fetchLeaderDeadlineNotifications(
  profileId: string,
  includeRead: boolean = false
): Promise<ReportDeadlineNotificationWithDetails[]> {
  let query = supabase
    .from('report_deadline_notifications')
    .select(`
      *,
      deadline:report_deadlines(
        *,
        ministries(name)
      )
    `)
    .eq('leader_id', profileId)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false });

  if (!includeRead) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((notification: any) => ({
    ...notification,
    deadline: notification.deadline ? {
      ...notification.deadline,
      ministry_name: notification.deadline.ministries?.name,
    } : undefined,
  }));
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('report_deadline_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Mark all notifications as read for a leader
 */
export async function markAllNotificationsAsRead(leaderId: string): Promise<void> {
  const { error } = await supabase
    .from('report_deadline_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('leader_id', leaderId)
    .eq('is_read', false);

  if (error) throw error;
}

/**
 * Dismiss notification
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('report_deadline_notifications')
    .update({
      is_dismissed: true,
      dismissed_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Get count of unread notifications for a leader
 */
export async function getUnreadNotificationCount(leaderId: string): Promise<number> {
  const { count, error } = await supabase
    .from('report_deadline_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('leader_id', leaderId)
    .eq('is_read', false)
    .eq('is_dismissed', false);

  if (error) throw error;
  return count || 0;
}

/**
 * Get upcoming deadlines for a leader (next 7 days)
 */
export async function getUpcomingDeadlines(profileId: string): Promise<ReportDeadlineWithDetails[]> {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get ministries where user is a leader
  const { data: ministryData, error: ministryError } = await supabase
    .from('ministries')
    .select('id')
    .eq('leader_id', profileId);

  if (ministryError) throw ministryError;

  const ministryIds = ministryData?.map((m: any) => m.id) || [];

  if (ministryIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('report_deadlines')
    .select(`
      *,
      ministries(name)
    `)
    .in('ministry_id', ministryIds)
    .eq('is_completed', false)
    .gte('deadline_date', now.toISOString())
    .lte('deadline_date', sevenDaysLater.toISOString())
    .order('deadline_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((deadline: any) => ({
    ...deadline,
    ministry_name: deadline.ministries?.name,
  }));
}

/**
 * Get overdue deadlines for a leader
 */
export async function getOverdueDeadlines(profileId: string): Promise<ReportDeadlineWithDetails[]> {
  const now = new Date();

  // Get ministries where user is a leader
  const { data: ministryData, error: ministryError } = await supabase
    .from('ministries')
    .select('id')
    .eq('leader_id', profileId);

  if (ministryError) throw ministryError;

  const ministryIds = ministryData?.map((m: any) => m.id) || [];

  if (ministryIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('report_deadlines')
    .select(`
      *,
      ministries(name)
    `)
    .in('ministry_id', ministryIds)
    .eq('is_completed', false)
    .lt('deadline_date', now.toISOString())
    .order('deadline_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((deadline: any) => ({
    ...deadline,
    ministry_name: deadline.ministries?.name,
  }));
}
