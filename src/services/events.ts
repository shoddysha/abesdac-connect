import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';
import { logAudit } from './audit';

export async function fetchEvents() {
  const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: true });
  if (error) throw error;
  return data as Event[];
}

export async function createEvent(payload: Partial<Event>) {
  const { data, error } = await supabase.from('events').insert(payload).select().single();
  if (error) throw error;
  
  // Log audit
  await logAudit(
    'create',
    'events',
    `Event created: ${data.title}`,
    data.id,
    (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
  
  return data as Event;
}

export async function updateEvent(id: string, payload: Partial<Event>) {
  // Get original event to check if status changed to cancelled
  const { data: originalEvent } = await supabase
    .from('events')
    .select('status, title, start_time, location')
    .eq('id', id)
    .single();
  
  const { data, error } = await supabase.from('events').update(payload).eq('id', id).select().single();
  if (error) throw error;
  
  // Log audit
  let auditMessage = `Event updated: ${data.title}`;
  if (originalEvent && originalEvent.status !== 'cancelled' && payload.status === 'cancelled') {
    auditMessage = `Event cancelled: ${data.title}`;
  }
  
  await logAudit(
    'update',
    'events',
    auditMessage,
    id,
    (await supabase.auth.getUser()).data.user?.id,
    undefined
  );
  
  // If event was just cancelled, send notification to registered attendees immediately
  if (originalEvent && originalEvent.status !== 'cancelled' && payload.status === 'cancelled') {
    try {
      const { queueEventCancellationAlert, processPendingNotifications } = await import('./notifications');
      await queueEventCancellationAlert(
        id,
        data.title,
        data.start_time
      );
      // Process immediately (don't wait for scheduler)
      await processPendingNotifications();
    } catch (err) {
      console.error('Failed to send event cancellation alert:', err);
      // Don't throw - event update was successful
    }
  }
  
  return data as Event;
}

export async function deleteEvent(id: string) {
  // Get event title for audit log
  const { data: event } = await supabase
    .from('events')
    .select('title')
    .eq('id', id)
    .single();
  
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
  
  // Log audit
  if (event) {
    await logAudit(
      'delete',
      'events',
      `Event deleted: ${event.title}`,
      id,
      (await supabase.auth.getUser()).data.user?.id,
      undefined
    );
  }
}
