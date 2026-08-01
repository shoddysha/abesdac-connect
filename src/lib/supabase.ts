import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project URL and anon key.'
  );
}

// Note: we intentionally don't pass a generic Database type here. Every
// service function in src/services/*.ts already casts its results to the
// correct TypeScript type (e.g. `as Member[]`) using the types defined in
// src/types/database.ts, so type-safety comes from those explicit casts
// rather than from constraining the client itself.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
