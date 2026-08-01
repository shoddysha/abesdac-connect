import { supabase } from '@/lib/supabase';
import type { AttendanceType } from '@/types/database';

export interface CheckinSession {
  id: string;
  token: string;
  attendance_type: AttendanceType;
  event_id: string | null;
  service_date: string;
  is_active: boolean;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

// ---- Admin/secretary side (normal authenticated requests, governed by RLS) ----

export async function createCheckinSession(payload: {
  attendance_type: AttendanceType;
  event_id?: string | null;
  service_date: string;
  created_by?: string;
}) {
  const { data, error } = await supabase.from('checkin_sessions').insert(payload).select().single();
  if (error) throw error;
  return data as CheckinSession;
}

export async function fetchActiveCheckinSession(attendance_type: AttendanceType, service_date: string, event_id?: string) {
  let query = supabase
    .from('checkin_sessions')
    .select('*')
    .eq('attendance_type', attendance_type)
    .eq('service_date', service_date)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  query = event_id ? query.eq('event_id', event_id) : query.is('event_id', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as CheckinSession | null;
}

export async function deactivateCheckinSession(id: string) {
  const { error } = await supabase.from('checkin_sessions').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

// ---- Public side (no login required — these call SECURITY DEFINER
// Postgres functions defined in supabase/schema.sql section 16, which
// only expose exactly what an anonymous scanner needs) ----

export async function getCheckinSessionInfo(token: string) {
  const { data, error } = await supabase.rpc('get_checkin_session', { p_token: token });
  if (error) throw error;
  return data?.[0] as
    | { attendance_type: AttendanceType; service_date: string; event_title: string | null; valid: boolean }
    | undefined;
}

export async function searchCheckinMembers(token: string, query: string) {
  const { data, error } = await supabase.rpc('search_checkin_members', { p_token: token, p_query: query });
  if (error) throw error;
  return (data ?? []) as { id: string; first_name: string; last_name: string; member_code: string }[];
}

export async function submitSelfCheckIn(token: string, memberId: string) {
  const { data, error } = await supabase.rpc('self_check_in', { p_token: token, p_member_id: memberId });
  if (error) throw error;
  return data?.[0] as { success: boolean; message: string } | undefined;
}
