import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, Users, CalendarDays, BarChart3, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

const FEATURES = [
  { icon: Users,        label: 'Member Management',  desc: 'Track every member & follow-up' },
  { icon: CalendarDays, label: 'Events & Attendance', desc: 'Schedule & record services' },
  { icon: BarChart3,    label: 'Reports & Analytics', desc: 'Real-time dashboards' },
  { icon: Shield,       label: 'Secure & Role-based', desc: 'Fine-grained access control' },
];

export function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await signIn(values.email, values.password);
    if (error) { setServerError(error); return; }
    navigate('/');
  }

  return (
    <>
      {/* Spin keyframes injected once */}
      <style>{`
        @keyframes spin3d {
          0%   { transform: perspective(600px) rotateY(0deg); }
          100% { transform: perspective(600px) rotateY(360deg); }
        }
        .logo-spin {
          animation: spin3d 6s linear infinite;
          transform-style: preserve-3d;
        }
        .logo-spin:hover {
          animation-duration: 1.2s;
        }
      `}</style>

      <div className="min-h-screen flex overflow-hidden">

        {/* ══════════════════════════════════════════════════════════
            LEFT — Blue panel (65% wide)
        ══════════════════════════════════════════════════════════ */}
        <div
          className="hidden lg:flex flex-col w-[65%] relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #1a3a6e 0%, #1e4d9b 40%, #1a3a6e 100%)' }}
        >
          {/* Background decorative circles (matches screenshot) */}
          <div
            className="absolute rounded-full"
            style={{
              width: 520, height: 520,
              right: -80, top: '15%',
              background: 'rgba(255,255,255,0.05)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 320, height: 320,
              right: 60, top: '30%',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 200, height: 200,
              left: '40%', bottom: '10%',
              background: 'rgba(255,255,255,0.04)',
            }}
          />

          {/* Inner layout */}
          <div className="relative z-10 flex flex-col h-full px-14 py-10">

            {/* ── TOP: Logo + name ── */}
            <div className="flex items-center gap-4">
              {/* White circular background so blue logo is visible */}
              <div
                className="logo-spin flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  width: 56, height: 56,
                  background: '#ffffff',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                }}
              >
                <img
                  src="/abeka.png"
                  alt="Abeka SDA Church"
                  style={{ width: 48, height: 48, objectFit: 'contain' }}
                />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">ABESDAC_Connect</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>Church Management System</p>
              </div>
            </div>

            {/* ── MIDDLE: Hero copy ── */}
            <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 460 }}>

              {/* Church location pill */}
              <div
                className="inline-flex items-center gap-2 self-start rounded-full mb-6"
                style={{
                  border: '1px solid rgba(74,222,128,0.35)',
                  background: 'rgba(74,222,128,0.1)',
                  padding: '6px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#86efac',
                }}
              >
                <span
                  className="rounded-full"
                  style={{ width: 7, height: 7, background: '#4ade80', display: 'inline-block', flexShrink: 0,
                    boxShadow: '0 0 6px #4ade80', animation: 'pulse 2s infinite' }}
                />
                Abeka SDA Church — Accra, Ghana
              </div>

              {/* Headline */}
              <h1
                className="font-extrabold text-white leading-tight tracking-tight"
                style={{ fontSize: 46 }}
              >
                Manage your church<br />
                <span style={{ color: '#93c5fd' }}>with confidence.</span>
              </h1>

              <p
                className="mt-5 leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, maxWidth: 400 }}
              >
                A complete administrative platform for tracking members, organizing
                ministries, and streamlining church operations.
              </p>

              {/* Feature cards — 2×2 grid */}
              <div className="grid grid-cols-2 gap-3 mt-10" style={{ maxWidth: 460 }}>
                {FEATURES.map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex items-start gap-3 rounded-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      padding: '14px 16px',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{ width: 34, height: 34, background: 'rgba(147,197,253,0.2)' }}
                    >
                      <Icon size={16} color="#93c5fd" />
                    </div>
                    <div>
                      <p className="font-semibold text-white" style={{ fontSize: 12 }}>{label}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.4 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── BOTTOM: Footer ── */}
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: 20,
                marginTop: 32,
              }}
            >
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                © {new Date().getFullYear()} ABESDAC_Connect — Abeka SDA Church. All rights reserved.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 4 }}>
                Designed &amp; developed by{' '}
                <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>NextGen_Developer</span>
              </p>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            RIGHT — White form panel (35%)
        ══════════════════════════════════════════════════════════ */}
        <div
          className="flex flex-1 flex-col"
          style={{ background: '#f5f7fa' }}
        >

          {/* Mobile top bar */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200 lg:hidden">
            <div className="h-9 w-9 rounded-xl bg-white shadow flex items-center justify-center overflow-hidden">
              <img src="/abeka.png" alt="logo" className="h-8 w-8 object-contain" />
            </div>
            <p className="font-bold text-slate-900 text-sm">ABESDAC_Connect</p>
          </div>

          {/* Centered card */}
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div
              className="w-full rounded-3xl"
              style={{
                maxWidth: 400,
                background: '#ffffff',
                boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
                padding: '40px 36px',
              }}
            >
              {/* Heading */}
              <h2
                className="font-extrabold tracking-tight"
                style={{ fontSize: 26, color: '#0f172a' }}
              >
                Welcome back
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', marginTop: 6 }}>
                Sign in to{' '}
                <span style={{ color: '#2563eb', fontWeight: 500 }}>your administrator account</span>
              </p>

              {/* Server error */}
              {serverError && (
                <div
                  className="flex items-start gap-3 rounded-xl mt-5"
                  style={{ background: '#fff5f5', border: '1px solid #fecdca', padding: '12px 14px', fontSize: 13, color: '#b91c1c' }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} style={{ marginTop: 28 }}>

                {/* Email */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="admin@abekasda.org"
                    autoComplete="email"
                    {...register('email')}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px',
                      fontSize: 14, color: '#111827', background: '#f9fafb',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#2563eb')}
                    onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                  />
                  {errors.email && (
                    <p style={{ marginTop: 5, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={11} />{errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...register('password')}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 42px 11px 14px',
                        fontSize: 14, color: '#111827', background: '#f9fafb',
                        outline: 'none', transition: 'border-color 0.2s',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#2563eb')}
                      onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0,
                      }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p style={{ marginTop: 5, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={11} />{errors.password.message}
                    </p>
                  )}
                </div>

                {/* Forgot password */}
                <div style={{ textAlign: 'right', marginBottom: 22 }}>
                  <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 500, cursor: 'pointer' }}>
                    Forgot password?
                  </span>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    background: isSubmitting ? '#93c5fd' : '#1d4ed8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '13px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(29,78,216,0.35)',
                    transition: 'background 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { if (!isSubmitting) (e.currentTarget.style.background = '#1e40af'); }}
                  onMouseLeave={e => { if (!isSubmitting) (e.currentTarget.style.background = '#1d4ed8'); }}
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Signing in…</>
                  ) : 'Sign In'}
                </button>
              </form>

              {/* Need access */}
              <div style={{ marginTop: 28, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#9ca3af' }}>
                  Need access?{' '}
                  <span style={{ color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>
                    Contact the church administrator
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Right panel footer (desktop) */}
          <div className="hidden lg:block px-8 pb-6 text-center">
            <p style={{ fontSize: 11, color: '#94a3b8' }}>
              © {new Date().getFullYear()} ABESDAC_Connect · Built by NextGen_Developer
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
