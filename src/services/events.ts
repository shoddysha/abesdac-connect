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
  const { data, error } = await supabase.from('events').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data as Event;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}
