import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/types/database';

export async function fetchAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AuditLog[];
}

export async function logAudit(
  action: string,
  module: string,
  description: string,
  recordId?: string,
  userId?: string,
  userName?: string
) {
  const { error } = await supabase.from('audit_logs').insert({
    action,
    module,
    description,
    record_id: recordId || null,
    user_id: userId || null,
    user_name: userName || null,
  });
  if (error) {
    console.error('Failed to log audit:', error);
  }
}
