import { supabase } from '@/lib/supabase';

// Allowed MIME types and extensions for image uploads.
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Invalid file type "${file.type}". Only JPEG, PNG, WebP, and GIF images are allowed.`);
  }
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    throw new Error(`Invalid file extension ".${ext}". Only .jpg, .png, .webp, and .gif are allowed.`);
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 5 MB.`);
  }
}

export async function uploadMemberImage(file: File, memberCode: string) {
  validateImageFile(file);
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${memberCode}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('member-images').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('member-images').getPublicUrl(path);
  return data.publicUrl;
}

// Ministry logos live in the existing "church-assets" bucket (already
// public + admin/secretary-writable — see supabase/schema.sql section 13).
export async function uploadMinistryLogo(file: File, ministryName: string) {
  validateImageFile(file);
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const safeName = ministryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const path = `ministry-logos/${safeName}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('church-assets').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('church-assets').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImportFile(file: File) {
  const path = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('imports').upload(path, file);
  if (error) throw error;
  return path;
}

// User profile photos. Needs its own "avatars" bucket: public read, and
// writes restricted to each user's own `${userId}/` folder. If that
// bucket doesn't exist yet in Supabase, create it (Storage → New bucket
// → "avatars", public) and add these policies:
//
//   create policy "avatars: public read" on storage.objects
//     for select using (bucket_id = 'avatars');
//
//   create policy "avatars: self write" on storage.objects
//     for insert with check (
//       bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
//     );
//
//   create policy "avatars: self update" on storage.objects
//     for update using (
//       bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
//     );
export async function uploadAvatar(file: File, userId: string) {
  validateImageFile(file);
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}