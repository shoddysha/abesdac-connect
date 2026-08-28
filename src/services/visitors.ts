import { supabase } from '@/lib/supabase';
import { logAudit } from './audit';

export interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  email: string | null;
  visit_date: string;
  visit_type: 'sabbath_service' | 'midweek_service' | 'event';
  followed_up: boolean;
  notes: string | null;
  created_at: string;
}

export async function fetchRecentVisitors(limit: number = 10): Promise<Visitor[]> {
  const { data, error } = await supabase
    .from('visitors')
    .select('*')
    .order('visit_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function fetchUnfollowedVisitors(): Promise<Visitor[]> {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .eq('followed_up', false)
      .order('visit_date', { ascending: false });

    if (error) {
      // Table might not exist yet - return empty array
      console.warn('Visitors table not found:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Error fetching visitors:', err);
    return [];
  }
}

export async function createVisitor(visitor: Omit<Visitor, 'id' | 'created_at'>): Promise<Visitor> {
  const { data, error } = await supabase
    .from('visitors')
    .insert(visitor)
    .select()
    .single();

  if (error) throw error;
  
  // Log audit
  await logAudit(
    'create',
    'visitors',
    `New visitor recorded: ${data.first_name} ${data.last_name}`,
    data.id,
    (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
  
  // Queue welcome SMS if phone number is provided
  if (data.phone_number) {
    try {
      const { queueVisitorWelcomeSms } = await import('./notifications');
      await queueVisitorWelcomeSms(
        data.id,
        data.first_name,
        data.last_name,
        data.phone_number,
        data.visit_date
      );
    } catch (err) {
      console.error('Failed to queue visitor welcome SMS:', err);
      // Don't throw - visitor was created successfully
    }
  }
  
  return data;
}

export async function updateVisitor(id: string, updates: Partial<Visitor>): Promise<void> {
  const { error } = await supabase
    .from('visitors')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  
  // Log audit
  await logAudit(
    'update',
    'visitors',
    `Visitor information updated`,
    id,
    (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
}

export async function deleteVisitor(id: string): Promise<void> {
  // Get visitor name for audit log
  const { data: visitor } = await supabase
    .from('visitors')
    .select('first_name, last_name')
    .eq('id', id)
    .single();
  
  const { error } = await supabase.from('visitors').delete().eq('id', id);
  if (error) throw error;
  
  // Log audit
  if (visitor) {
    await logAudit(
      'delete',
      'visitors',
      `Visitor deleted: ${visitor.first_name} ${visitor.last_name}`,
      id,
      (await supabase.auth.getUser()).data.user?.id,
      undefined
    );
  }
}

export async function markAsFollowedUp(id: string): Promise<void> {
  await updateVisitor(id, { followed_up: true });
}
