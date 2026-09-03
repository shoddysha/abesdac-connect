import { supabase } from '@/lib/supabase';

export interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  description: string | null;
  release_date: string;
  features: Array<{ title: string; description: string }>;
  bug_fixes: Array<{ title: string; description: string }>;
  improvements: Array<{ title: string; description: string }>;
  is_published: boolean;
  created_at: string;
}

export interface Documentation {
  id: string;
  category: string;
  title: string;
  slug: string;
  content: string;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoTutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_minutes: number | null;
  category: string;
  order_index: number;
  view_count: number;
  is_published: boolean;
  created_at: string;
}

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  order_index: number;
  view_count: number;
  is_published: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string | null;
  subject: string;
  message: string;
  status: string;
  priority: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch published release notes
export async function fetchReleaseNotes(): Promise<ReleaseNote[]> {
  const { data, error } = await supabase
    .from('release_notes')
    .select('*')
    .eq('is_published', true)
    .order('release_date', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data || []) as ReleaseNote[];
}

// Fetch latest release note
export async function fetchLatestRelease(): Promise<ReleaseNote | null> {
  const { data, error } = await supabase
    .from('release_notes')
    .select('*')
    .eq('is_published', true)
    .order('release_date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as ReleaseNote | null;
}

// Fetch documentation by category
export async function fetchDocumentation(category?: string): Promise<Documentation[]> {
  let query = supabase
    .from('help_documentation')
    .select('*')
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Documentation[];
}

// Fetch single documentation by slug
export async function fetchDocumentationBySlug(slug: string): Promise<Documentation | null> {
  const { data, error } = await supabase
    .from('help_documentation')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Documentation | null;
}

// Fetch documentation categories
export async function fetchDocumentationCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('help_documentation')
    .select('category')
    .eq('is_published', true);

  if (error) throw error;
  
  const categories = [...new Set((data || []).map(d => d.category))];
  return categories;
}

// Fetch video tutorials
export async function fetchVideoTutorials(category?: string): Promise<VideoTutorial[]> {
  let query = supabase
    .from('video_tutorials')
    .select('*')
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as VideoTutorial[];
}

// Fetch FAQs
export async function fetchFAQs(category?: string): Promise<FAQ[]> {
  let query = supabase
    .from('faqs')
    .select('*')
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as FAQ[];
}

// Get FAQ categories
export async function fetchFAQCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('faqs')
    .select('category')
    .eq('is_published', true);

  if (error) throw error;
  
  const categories = [...new Set((data || []).map(d => d.category))];
  return categories;
}

// Create support ticket
export async function createSupportTicket(ticket: {
  subject: string;
  message: string;
  priority?: string;
}): Promise<SupportTicket> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user?.id || null,
      subject: ticket.subject,
      message: ticket.message,
      priority: ticket.priority || 'medium',
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return data as SupportTicket;
}

// Fetch user's support tickets
export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SupportTicket[];
}

// Increment view count
export async function incrementDocView(slug: string): Promise<void> {
  const doc = await fetchDocumentationBySlug(slug);
  if (!doc) return;

  await supabase.rpc('increment_view_count', {
    table_name: 'help_documentation',
    record_id: doc.id
  });
}

export async function incrementFAQView(faqId: string): Promise<void> {
  await supabase.rpc('increment_view_count', {
    table_name: 'faqs',
    record_id: faqId
  });
}

export async function incrementVideoView(videoId: string): Promise<void> {
  await supabase.rpc('increment_view_count', {
    table_name: 'video_tutorials',
    record_id: videoId
  });
}
