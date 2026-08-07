import { supabase } from '@/lib/supabase';

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
  return data;
}

export async function updatePrayerRequest(
  id: string,
  updates: UpdatePrayerRequestInput
): Promise<void> {
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
}

export async function deletePrayerRequest(id: string): Promise<void> {
  const { error } = await supabase.from('prayer_requests').delete().eq('id', id);
  if (error) throw error;
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
 * Sync prayer requests from Google Sheets (connected to Google Form responses)
 * Returns the number of new requests imported
 */
export async function syncGoogleFormResponses(): Promise<number> {
  // Call the Edge Function that fetches from Google Sheets and imports new rows
  const { data, error } = await supabase.functions.invoke('sync-prayer-requests', {
    method: 'POST',
  });

  if (error) throw error;
  return data?.newCount ?? 0;
}
