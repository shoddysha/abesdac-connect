import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

const schema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

type PageState = 'waiting' | 'ready' | 'expired';

export function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('waiting');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Supabase JS v2 automatically detects the #access_token fragment in the
  // URL and fires onAuthStateChange with event='PASSWORD_RECOVERY'.
  // We wait for that event before showing the form so updateUser() has a
  // valid session to work with.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready');
      }
    });

    // If there's no token fragment at all (user navigated here directly),
    // mark as expired after a short grace period so we don't spin forever.
    const fallback = setTimeout(() => {
      setPageState((prev) => (prev === 'waiting' ? 'expired' : prev));
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await updatePassword(values.password);
    if (error) {
      setServerError(error);
      return;
    }
    toast.success('Password updated successfully. Please sign in with your new password.');
    // Sign out the recovery session so the user logs in fresh
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(145deg, #1a3a6e 0%, #1e4d9b 40%, #1a3a6e 100%)' }}
    >
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full" style={{ width: 520, height: 520, right: -100, top: '10%', background: 'rgba(255,255,255,0.04)' }} />
        <div className="absolute rounded-full" style={{ width: 300, height: 300, left: -60, bottom: '15%', background: 'rgba(255,255,255,0.04)' }} />
      </div>

      <div className="relative w-full max-w-md z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="rounded-2xl overflow-hidden flex items-center justify-center mb-4"
            style={{ width: 64, height: 64, background: '#ffffff', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
          >
            <img src="/abeka.png" alt="ABESDAC logo" style={{ width: 54, height: 54, objectFit: 'contain' }} />
          </div>
          <p className="text-white font-bold text-lg">ABESDAC_Connect</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>Church Management System</p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl"
          style={{ background: '#ffffff', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', padding: '40px 36px' }}
        >

          {/* ── Waiting for token exchange ── */}
          {pageState === 'waiting' && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <Loader2 size={36} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Verifying your reset link…</p>
            </div>
          )}

          {/* ── Link expired or invalid ── */}
          {pageState === 'expired' && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 64, height: 64, background: '#fef2f2', border: '2px solid #fecaca' }}
              >
                <AlertCircle size={32} color="#dc2626" />
              </div>
              <h2 className="font-extrabold text-slate-900 text-xl">Link expired or invalid</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                This password reset link has expired or has already been used.
                Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: '#1d4ed8' }}
              >
                Request a new link
              </Link>
            </div>
          )}

          {/* ── Form — token verified ── */}
          {pageState === 'ready' && (
            <>
              <h2 className="font-extrabold text-slate-900 tracking-tight mb-1" style={{ fontSize: 24 }}>
                Set a new password
              </h2>
              <p className="text-slate-500 text-sm mb-7">
                Choose a strong password you haven't used before.
              </p>

              {serverError && (
                <div
                  className="flex items-start gap-3 rounded-xl mb-5"
                  style={{ background: '#fff5f5', border: '1px solid #fecdca', padding: '12px 14px', fontSize: 13, color: '#b91c1c' }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                  error={errors.password?.message}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                />
                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  <ShieldCheck className="h-4 w-4" />
                  Update password
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Back to login */}
        <div className="flex justify-center mt-6">
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#fff')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)')}
          >
            <ArrowLeft size={14} /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
