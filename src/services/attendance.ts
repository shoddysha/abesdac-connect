import { supabase } from '@/lib/supabase';
import type { Attendance, AttendanceType } from '@/types/database';

export async function fetchAttendanceByDate(serviceDate: string, attendanceType: AttendanceType, eventId?: string) {
  let query = supabase
    .from('attendance')
    .select('*, members(id, first_name, last_name, member_code, profile_image_url)')
    .eq('service_date', serviceDate)
    .eq('attendance_type', attendanceType);
  if (eventId) query = query.eq('event_id', eventId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function checkInMember(payload: {
  member_id: string;
  attendance_type: AttendanceType;
  service_date: string;
  event_id?: string | null;
  recorded_by: string;
}) {
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      { ...payload, check_in_time: new Date().toISOString() },
      { onConflict: 'member_id,attendance_type,event_id,service_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Attendance;
}

export async function checkOutMember(attendanceId: string) {
  const { data, error } = await supabase
    .from('attendance')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', attendanceId)
    .select()
    .single();
  if (error) throw error;
  return data as Attendance;
}

export async function removeAttendance(attendanceId: string) {
  const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
  if (error) throw error;
}

/** Returns each member's attendance count and percentage over the given date range. */
export async function fetchAttendanceSummary(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select('member_id, service_date, members(first_name, last_name, member_code)')
    .gte('service_date', startDate)
    .lte('service_date', endDate);
  if (error) throw error;
  return data;
}
