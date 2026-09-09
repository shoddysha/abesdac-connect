import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await requestPasswordReset(values.email);
    if (error) {
      setServerError(error);
      return;
    }
    setSubmittedEmail(values.email);
    setSent(true);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(145deg, #1a3a6e 0%, #1e4d9b 40%, #1a3a6e 100%)' }}
    >
      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full" style={{ width: 520, height: 520, right: -100, top: '10%', background: 'rgba(255,255,255,0.04)' }} />
        <div className="absolute rounded-full" style={{ width: 300, height: 300, left: -60, bottom: '15%', background: 'rgba(255,255,255,0.04)' }} />
        <div className="absolute rounded-full" style={{ width: 180, height: 180, left: '45%', top: '5%', background: 'rgba(255,255,255,0.03)' }} />
      </div>

      <div className="relative w-full max-w-md z-10">

        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="rounded-2xl overflow-hidden flex items-center justify-center mb-4"
            style={{
              width: 64, height: 64,
              background: '#ffffff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <img src="/abeka.png" alt="ABESDAC logo" style={{ width: 54, height: 54, objectFit: 'contain' }} />
          </div>
          <p className="text-white font-bold text-lg">ABESDAC_Connect</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>Church Management System</p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl"
          style={{
            background: '#ffffff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            padding: '40px 36px',
          }}
        >
          {sent ? (
            /* ── Success state ── */
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center rounded-full mb-5"
                style={{ width: 64, height: 64, background: '#f0fdf4', border: '2px solid #bbf7d0' }}
              >
                <CheckCircle size={32} color="#16a34a" />
              </div>
              <h2 className="font-extrabold text-slate-900" style={{ fontSize: 22 }}>Check your inbox</h2>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                We sent a password reset link to{' '}
                <span className="font-semibold text-slate-700">{submittedEmail}</span>.
                <br />Click the link in the email to set a new password.
              </p>
              <p className="text-xs text-slate-400 mt-4">
                Didn't receive it? Check your spam folder or try again.
              </p>
              <button
                onClick={() => setSent(false)}
                style={{
                  marginTop: 20, fontSize: 13, color: '#2563eb',
                  background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Try a different email →
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h2 className="font-extrabold text-slate-900 tracking-tight" style={{ fontSize: 24 }}>
                Reset your password
              </h2>
              <p className="text-slate-500 text-sm mt-2 mb-7">
                Enter your account email and we'll send you a secure reset link.
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

              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Email field */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Email address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={16}
                      color="#9ca3af"
                      style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    />
                    <input
                      type="email"
                      placeholder="you@abekasda.org"
                      autoComplete="email"
                      {...register('email')}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        border: '1.5px solid #e5e7eb', borderRadius: 10,
                        padding: '11px 14px 11px 40px',
                        fontSize: 14, color: '#111827', background: '#f9fafb',
                        outline: 'none', transition: 'border-color 0.2s',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#2563eb')}
                      onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>
                  {errors.email && (
                    <p style={{ marginTop: 5, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={11} />{errors.email.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: isSubmitting ? '#93c5fd' : '#1d4ed8',
                    color: '#fff',
                    border: 'none', borderRadius: 10,
                    padding: '13px',
                    fontSize: 15, fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(29,78,216,0.35)',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => { if (!isSubmitting) (e.currentTarget.style.background = '#1e40af'); }}
                  onMouseLeave={e => { if (!isSubmitting) (e.currentTarget.style.background = '#1d4ed8'); }}
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending link…</>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
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
