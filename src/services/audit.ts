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
