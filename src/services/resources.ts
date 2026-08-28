import { supabase } from '@/lib/supabase';

export type SermonCategory = 'sunday_service' | 'midweek_service' | 'special_event' | 'conference';
export type DocumentCategory = 'bulletin' | 'announcement' | 'report' | 'newsletter' | 'policy' | 'other';

export interface Sermon {
  id: string;
  title: string;
  youtube_url: string;
  youtube_id: string | null;
  preacher_name: string;
  date_preached: string;
  scripture_reference: string | null;
  description: string | null;
  thumbnail_url: string | null;
  uploaded_by: string | null;
  ministry_id: string | null;
  is_featured: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
  };
  ministries?: {
    name: string;
  };
}

export interface ChurchDocument {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  category: DocumentCategory;
  description: string | null;
  uploaded_by: string | null;
  is_public: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
  };
}

export interface CreateSermonInput {
  title: string;
  youtube_url: string;
  preacher_name: string;
  date_preached: string;
  scripture_reference?: string;
  description?: string;
  ministry_id?: string;
  is_featured?: boolean;
}

export interface CreateDocumentInput {
  title: string;
  file: File;
  category: DocumentCategory;
  description?: string;
  is_public?: boolean;
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}default.jpg`;
}

/**
 * Fetch all sermons
 */
export async function fetchSermons(filters?: {
  featured?: boolean;
  ministryId?: string;
  limit?: number;
}): Promise<Sermon[]> {
  let query = supabase
    .from('sermons')
    .select(`
      *,
      profiles:uploaded_by(full_name),
      ministries:ministry_id(name)
    `)
    .order('date_preached', { ascending: false });

  if (filters?.featured !== undefined) {
    query = query.eq('is_featured', filters.featured);
  }

  if (filters?.ministryId) {
    query = query.eq('ministry_id', filters.ministryId);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single sermon by ID
 */
export async function fetchSermon(id: string): Promise<Sermon | null> {
  const { data, error } = await supabase
    .from('sermons')
    .select(`
      *,
      profiles:uploaded_by(full_name),
      ministries:ministry_id(name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new sermon
 */
export async function createSermon(input: CreateSermonInput): Promise<Sermon> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const youtubeId = extractYouTubeId(input.youtube_url);
  if (!youtubeId) {
    throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
  }

  const thumbnailUrl = getYouTubeThumbnail(youtubeId, 'hq');

  const { data, error } = await supabase
    .from('sermons')
    .insert({
      title: input.title,
      youtube_url: input.youtube_url,
      youtube_id: youtubeId,
      preacher_name: input.preacher_name,
      date_preached: input.date_preached,
      scripture_reference: input.scripture_reference || null,
      description: input.description || null,
      thumbnail_url: thumbnailUrl,
      ministry_id: input.ministry_id || null,
      is_featured: input.is_featured || false,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a sermon
 */
export async function updateSermon(id: string, updates: Partial<CreateSermonInput>): Promise<Sermon> {
  const updateData: any = { ...updates };

  // If YouTube URL is being updated, extract new ID and thumbnail
  if (updates.youtube_url) {
    const youtubeId = extractYouTubeId(updates.youtube_url);
    if (!youtubeId) {
      throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }
    updateData.youtube_id = youtubeId;
    updateData.thumbnail_url = getYouTubeThumbnail(youtubeId, 'hq');
  }

  const { data, error } = await supabase
    .from('sermons')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a sermon
 */
export async function deleteSermon(id: string): Promise<void> {
  const { error } = await supabase
    .from('sermons')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Increment sermon view count
 */
export async function incrementSermonViews(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_sermon_views', { sermon_id: id });
  
  // If function doesn't exist, fallback to manual increment
  if (error) {
    const { data: sermon } = await supabase
      .from('sermons')
      .select('view_count')
      .eq('id', id)
      .single();

    if (sermon) {
      await supabase
        .from('sermons')
        .update({ view_count: (sermon.view_count || 0) + 1 })
        .eq('id', id);
    }
  }
}

/**
 * Fetch all documents
 */
export async function fetchDocuments(filters?: {
  category?: DocumentCategory;
  isPublic?: boolean;
  limit?: number;
}): Promise<ChurchDocument[]> {
  let query = supabase
    .from('church_documents')
    .select(`
      *,
      profiles:uploaded_by(full_name)
    `)
    .order('created_at', { ascending: false });

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.isPublic !== undefined) {
    query = query.eq('is_public', filters.isPublic);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single document by ID
 */
export async function fetchDocument(id: string): Promise<ChurchDocument | null> {
  const { data, error } = await supabase
    .from('church_documents')
    .select(`
      *,
      profiles:uploaded_by(full_name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Upload a document to Supabase Storage and create database record
 */
export async function createDocument(input: CreateDocumentInput): Promise<ChurchDocument> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate file type (only PDFs for now)
  if (input.file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed. Please upload a PDF document.');
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (input.file.size > maxSize) {
    throw new Error('File size exceeds 10MB. Please upload a smaller file.');
  }

  // Generate unique file name
  const fileExt = 'pdf';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${user.id}/${fileName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('church-documents')
    .upload(filePath, input.file, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('church-documents')
    .getPublicUrl(filePath);

  // Create database record
  const { data, error } = await supabase
    .from('church_documents')
    .insert({
      title: input.title,
      file_url: urlData.publicUrl,
      file_name: input.file.name,
      file_size: input.file.size,
      category: input.category,
      description: input.description || null,
      is_public: input.is_public !== false,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    // If database insert fails, try to delete the uploaded file
    await supabase.storage.from('church-documents').remove([filePath]);
    throw error;
  }

  return data;
}

/**
 * Update a document metadata
 */
export async function updateDocument(id: string, updates: {
  title?: string;
  category?: DocumentCategory;
  description?: string;
  is_public?: boolean;
}): Promise<ChurchDocument> {
  const { data, error } = await supabase
    .from('church_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a document (removes from storage and database)
 */
export async function deleteDocument(id: string): Promise<void> {
  // First, get the document to find the file path
  const { data: doc, error: fetchError } = await supabase
    .from('church_documents')
    .select('file_url')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Extract file path from URL
  const urlParts = doc.file_url.split('/church-documents/');
  if (urlParts.length === 2) {
    const filePath = urlParts[1].split('?')[0]; // Remove query params if any

    // Delete from storage
    await supabase.storage
      .from('church-documents')
      .remove([filePath]);
  }

  // Delete from database
  const { error } = await supabase
    .from('church_documents')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Increment document download count
 */
export async function incrementDocumentDownloads(id: string): Promise<void> {
  const { data: doc } = await supabase
    .from('church_documents')
    .select('download_count')
    .eq('id', id)
    .single();

  if (doc) {
    await supabase
      .from('church_documents')
      .update({ download_count: (doc.download_count || 0) + 1 })
      .eq('id', id);
  }
}
