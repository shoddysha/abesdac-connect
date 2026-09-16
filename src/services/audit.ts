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

/**
 * Inserts an audit log row. user_id and user_name are derived from the
 * authenticated session — callers cannot supply them, preventing spoofing.
 */
export async function logAudit(
  action: string,
  module: string,
  description: string,
  recordId?: string
) {
  // Always read identity from the verified session, never from caller-supplied strings
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName: string | null = null;
  if (user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    userName = profile?.full_name ?? null;
  }

  const { error } = await supabase.from('audit_logs').insert({
    action,
    module,
    description,
    record_id: recordId ?? null,
    user_id: user?.id ?? null,
    user_name: userName,
  });
  if (error) {
    console.error('Failed to log audit:', error);
  }
}
