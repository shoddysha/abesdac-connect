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
