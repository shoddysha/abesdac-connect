import { supabase } from '@/lib/supabase';
import { logAudit } from './audit';

export type PrayerStatus = 'open' | 'ongoing' | 'answered';

export interface PrayerRequest {
  id: string;
  member_id: string | null;
  requested_by: string;
  request_text: string;
  status: PrayerStatus;
  is_anonymous: boolean;
  answered_at: string | null;
  answer_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  google_form_timestamp: string | null; // Track when it was submitted via Google Form
}

export interface CreatePrayerRequestInput {
  member_id?: string | null;
  requested_by: string;
  request_text: string;
  is_anonymous?: boolean;
  created_by?: string | null;
  google_form_timestamp?: string | null;
}

export interface UpdatePrayerRequestInput {
  status?: PrayerStatus;
  answer_notes?: string;
  answered_at?: string | null;
}

export async function fetchPrayerRequests(limit = 100): Promise<PrayerRequest[]> {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchPrayerRequestsByStatus(status: PrayerStatus): Promise<PrayerRequest[]> {
  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createPrayerRequest(input: CreatePrayerRequestInput): Promise<PrayerRequest> {
  const { data, error } = await supabase
    .from('prayer_requests')
    .insert({
      member_id: input.member_id ?? null,
      requested_by: input.requested_by,
      request_text: input.request_text,
      is_anonymous: input.is_anonymous ?? false,
      created_by: input.created_by ?? null,
      google_form_timestamp: input.google_form_timestamp ?? null,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  
  // Log audit
  await logAudit(
    'create',
    'prayer_requests',
    `New prayer request submitted${input.is_anonymous ? ' (Anonymous)' : ` by ${input.requested_by}`}`,
    data.id,
    input.created_by ?? (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
  
  return data;
}

export async function updatePrayerRequest(
  id: string,
  updates: UpdatePrayerRequestInput
): Promise<void> {
  // Get original prayer request to check status change
  const { data: originalRequest } = await supabase
    .from('prayer_requests')
    .select('status, request_text, requested_by, member_id, members(first_name, last_name, phone)')
    .eq('id', id)
    .single();
  
  const payload: any = { ...updates };

  // Auto-set answered_at when status changes to 'answered'
  if (updates.status === 'answered' && !updates.answered_at) {
    payload.answered_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('prayer_requests')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
  
  // Log audit
  let auditMessage = 'Prayer request updated';
  if (originalRequest && originalRequest.status !== 'answered' && updates.status === 'answered') {
    auditMessage = `Prayer request marked as ANSWERED for ${originalRequest.requested_by}`;
  } else if (updates.status) {
    auditMessage = `Prayer request status changed to ${updates.status}`;
  }
  
  await logAudit(
    'update',
    'prayer_requests',
    auditMessage,
    id,
    (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
  
  // If prayer was just answered, send notification
  if (originalRequest && originalRequest.status !== 'answered' && updates.status === 'answered') {
    try {
      const member = (originalRequest as any).members;
      if (member?.phone && originalRequest.member_id) {
        const { queuePrayerAnsweredNotification } = await import('./notifications');
        await queuePrayerAnsweredNotification(
          id,
          originalRequest.member_id,
          `${member.first_name} ${member.last_name}`,
          member.phone
        );
      }
    } catch (err) {
      console.error('Failed to queue prayer answered notification:', err);
      // Don't throw - prayer update was successful
    }
  }
}

export async function deletePrayerRequest(id: string): Promise<void> {
  // Get prayer request for audit log
  const { data: prayer } = await supabase
    .from('prayer_requests')
    .select('requested_by')
    .eq('id', id)
    .single();
  
  const { error } = await supabase.from('prayer_requests').delete().eq('id', id);
  if (error) throw error;
  
  // Log audit
  if (prayer) {
    await logAudit(
      'delete',
      'prayer_requests',
      `Prayer request deleted for ${prayer.requested_by}`,
      id,
      (await supabase.auth.getUser()).data.user?.id,
      undefined
    );
  }
}

export async function getOpenPrayerRequestsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('prayer_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  if (error) throw error;
  return count ?? 0;
}

/**
 * Sync prayer requests from Google Sheets
 * Returns the number of new requests imported
 */
export async function syncFromGoogleSheets(): Promise<number> {
  // This will call a Supabase Edge Function that fetches from Google Sheets API
  const { data, error } = await supabase.functions.invoke('sync-prayer-from-sheets', {
    method: 'POST',
  });

  if (error) throw new Error(error.message ||  'Failed to sync from Google Sheets');
  return data?.newCount ?? 0;
}
