import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, Shield, Users, CalendarDays, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

const FEATURES = [
  { icon: Users,        label: 'Member Management',  desc: 'Track every member, ministry and follow-up' },
  { icon: CalendarDays, label: 'Events & Attendance', desc: 'Schedule events and record service attendance' },
  { icon: BarChart3,    label: 'Reports & Analytics', desc: 'Gain insights with real-time dashboards' },
  { icon: Shield,       label: 'Secure & Role-based', desc: 'Fine-grained access control for every user' },
];

export function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await signIn(values.email, values.password);
    if (error) { setServerError(error); return; }
    navigate('/');
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT panel — dark, narrower (≈40%) ─────────────────── */}
      <div className="hidden lg:flex flex-col w-[42%] relative overflow-hidden">
        {/* Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 15% 55%, rgba(59,130,246,0.2) 0%, transparent 55%), radial-gradient(ellipse at 85% 10%, rgba(99,102,241,0.14) 0%, transparent 50%)',
          }}
        />

        {/* Decorative rings */}
        <div className="absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full border border-white/[0.06]" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full border border-white/[0.06]" />
        <div className="absolute top-24 right-0 h-56 w-56 rounded-full border border-white/[0.04]" />
        <div className="absolute top-40 right-16 h-28 w-28 rounded-full bg-blue-500/10" />

        {/* Inner content — flex-col with space-between */}
        <div className="relative z-10 flex flex-col h-full p-10">

          {/* Top: Logo */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden backdrop-blur-sm">
              <img src="/abeka.png" alt="ABESDAC logo" className="h-9 w-9 object-contain p-1" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">ABESDAC Connect</p>
              <p className="text-white/40 text-[11px]">Church Management System</p>
            </div>
          </div>

          {/* Middle: Hero copy */}
          <div className="flex-1 flex flex-col justify-center space-y-7">
            {/* Headline */}
            <div>
              <h1 className="text-4xl font-extrabold text-white leading-[1.1] tracking-tight">
                Manage your<br />
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  church with
                </span><br />
                confidence.
              </h1>
              <p className="mt-4 text-white/50 text-sm leading-relaxed">
                A complete administrative platform for tracking members, organizing ministries, and streamlining church operations.
              </p>
            </div>

            {/* Church pill — placed directly under the headline */}
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Abeka SDA Church · Accra, Ghana
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex items-start gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-3.5 backdrop-blur-sm"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
                    <Icon className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-white leading-tight">{label}</p>
                    <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Footer — properly spaced */}
          <div className="pt-8 border-t border-white/[0.08] mt-8">
            <p className="text-white/25 text-[11px]">
              © {new Date().getFullYear()} ABESDAC Connect
            </p>
            <p className="text-white/20 text-[11px] mt-0.5">
              Designed &amp; developed by{' '}
              <span className="text-white/35 font-medium">NextGen_Developer</span>
            </p>
          </div>

        </div>
      </div>

      {/* ── RIGHT panel — white, wider (fills remaining ≈58%) ───── */}
      <div className="flex flex-1 flex-col bg-white">

        {/* Mobile logo */}
        <div className="flex items-center gap-3 p-6 lg:hidden border-b border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
            <img src="/abeka.png" alt="ABESDAC logo" className="h-8 w-8 object-contain p-0.5" />
          </div>
          <p className="text-slate-900 font-bold text-base">ABESDAC Connect</p>
        </div>

        {/* Centered form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">

            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back</h2>
              <p className="text-slate-500 text-sm mt-2">Sign in to your administrator account to continue.</p>
            </div>

            {/* Server error */}
            {serverError && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="admin@abekasda.org"
                  autoComplete="email"
                  {...register('email')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In →'
                )}
              </button>
            </form>

            {/* Help section */}
            <div className="mt-8">
              <div className="relative flex items-center gap-3 mb-4">
                <div className="flex-1 border-t border-slate-100" />
                <span className="text-xs text-slate-400 flex-shrink-0">Need access?</span>
                <div className="flex-1 border-t border-slate-100" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
                <p className="text-sm text-slate-500">
                  Don't have an account?{' '}
                  <span className="font-semibold text-blue-600">Contact the church administrator</span>
                </p>
              </div>
            </div>

            {/* Mobile footer */}
            <p className="mt-10 text-center text-xs text-slate-400 lg:hidden">
              © {new Date().getFullYear()} ABESDAC Connect · NextGen_Developer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
