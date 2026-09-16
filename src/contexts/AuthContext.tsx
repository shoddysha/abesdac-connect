import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';

// Map raw Supabase/auth error messages to user-friendly strings.
// Raw messages can leak table names, column names, and constraint details.
const AUTH_ERROR_MAP: Record<string, string> = {
  'invalid login credentials':       'Incorrect email or password.',
  'invalid_credentials':             'Incorrect email or password.',
  'email not confirmed':             'Please verify your email address before signing in.',
  'user not found':                  'No account found with that email address.',
  'too many requests':               'Too many attempts. Please wait a moment and try again.',
  'over_email_send_rate_limit':      'Too many emails sent. Please wait before requesting another.',
  'password should be at least 6 characters': 'Password must be at least 6 characters.',
  'new password should be different from the old password': 'New password must be different from your current password.',
  'auth session missing':            'Your session has expired. Please sign in again.',
  'token has expired or is invalid': 'This link has expired. Please request a new one.',
  'user already registered':         'An account with this email already exists.',
  'signup is disabled':              'New account registration is not available at this time.',
};

function friendlyAuthError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const [key, friendly] of Object.entries(AUTH_ERROR_MAP)) {
    if (lower.includes(key)) return friendly;
  }
  // Fallback: return a generic message instead of the raw Supabase error
  // which may contain schema/table names.
  return 'Something went wrong. Please try again or contact the administrator.';
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  hasRole: (...roles: UserRole[]) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: friendlyAuthError(error?.message) };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: friendlyAuthError(error?.message) };
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: friendlyAuthError(error?.message) };
  }

  function hasRole(...roles: UserRole[]) {
    if (!profile) return false;
    return roles.includes(profile.role);
  }

  async function refreshProfile() {
    if (session?.user) {
      await loadProfile(session.user.id);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
        hasRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}