import { supabase } from '@/lib/supabase';

export async function uploadMemberImage(file: File, memberCode: string) {
  const ext = file.name.split('.').pop();
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
  const ext = file.name.split('.').pop();
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
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}