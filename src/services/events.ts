import { supabase } from '@/lib/supabase';
import type { Event } from '@/types/database';

export async function fetchEvents() {
  const { data, error } = await supabase.from('events').select('*').order('start_time', { ascending: true });
  if (error) throw error;
  return data as Event[];
}

export async function createEvent(payload: Partial<Event>) {
  const { data, error } = await supabase.from('events').insert(payload).select().single();
  if (error) throw error;
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
  
  // If event was just cancelled, send notification to registered attendees
  if (originalEvent && originalEvent.status !== 'cancelled' && payload.status === 'cancelled') {
    try {
      const { queueEventCancellationAlert } = await import('./notifications');
      await queueEventCancellationAlert(
        id,
        data.title,
        data.start_time,
        data.location || 'TBA'
      );
    } catch (err) {
      console.error('Failed to queue event cancellation alert:', err);
      // Don't throw - event update was successful
    }
  }
  
  return data as Event;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}
