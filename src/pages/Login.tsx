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
  { icon: Users,       label: 'Member Management',   desc: 'Track every member, ministry and follow-up' },
  { icon: CalendarDays,label: 'Events & Attendance',  desc: 'Schedule events and record service attendance' },
  { icon: BarChart3,   label: 'Reports & Analytics',  desc: 'Gain insights with real-time dashboards' },
  { icon: Shield,      label: 'Secure & Role-based',  desc: 'Fine-grained access control for every user' },
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
    <div className="min-h-screen flex bg-slate-950">

      {/* ── Left panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(ellipse at 20% 60%, rgba(59,130,246,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 10%, rgba(99,102,241,0.12) 0%, transparent 50%)' }} />
        {/* Decorative circles */}
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full border border-white/5" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full border border-white/5" />
        <div className="absolute top-32 right-8 h-48 w-48 rounded-full border border-white/5" />
        <div className="absolute top-48 right-20 h-24 w-24 rounded-full bg-blue-500/10" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 z-10">
          <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden backdrop-blur-sm">
            <img src="/abeka.png" alt="ABESDAC logo" className="h-10 w-10 object-contain p-1" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">ABESDAC Connect</p>
            <p className="text-white/40 text-xs">Church Management System</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Abeka SDA Church · Accra, Ghana
          </div>

          <div>
            <h1 className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              Manage your<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                church with
              </span><br />
              confidence.
            </h1>
            <p className="mt-5 text-white/50 text-base leading-relaxed max-w-sm">
              A complete administrative platform for tracking members, organizing ministries, and streamlining church operations.
            </p>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/25 text-xs">
          © {new Date().getFullYear()} ABESDAC Connect. Built by <span className="text-white/40 font-medium">NextGen_Developer</span>
        </p>
      </div>

      {/* ── Right panel (form) ───────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6 bg-white lg:rounded-l-[2.5rem]">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
              <img src="/abeka.png" alt="ABESDAC logo" className="h-9 w-9 object-contain p-0.5" />
            </div>
            <p className="text-slate-900 font-bold text-base">ABESDAC Connect</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-sm mt-1.5">Sign in to your account to continue</p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
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
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-slate-700">Password</label>
              </div>
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
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-blue-700/30 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider + help */}
          <div className="mt-8 space-y-4">
            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-xs text-slate-400 flex-shrink-0">Need help?</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-center">
              <p className="text-slate-500">
                Don't have an account?{' '}
                <span className="font-semibold text-blue-600">
                  Contact the church administrator
                </span>
              </p>
            </div>
          </div>

          {/* Mobile footer */}
          <p className="mt-8 text-center text-xs text-slate-400 lg:hidden">
            © {new Date().getFullYear()} ABESDAC Connect · NextGen_Developer
          </p>
        </div>
      </div>
    </div>
  );
}
