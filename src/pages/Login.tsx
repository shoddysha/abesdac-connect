import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

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
    if (error) {
      setServerError(error);
      return;
    }
    navigate('/');
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0F2A5F' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 50%, rgba(30,94,255,0.3) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full"
          style={{ background: 'rgba(30,94,255,0.15)', transform: 'translate(30%, 30%)' }}
        />
        <div className="absolute top-20 right-20 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-white">
            <img src="/abeka.png" alt="Abeka SDA Church logo" className="h-full w-full object-contain p-1" />
          </div>
          <div>
            <div className="text-white font-bold text-lg">ABESDAC_Connect</div>
            <div className="text-white/50 text-xs">Church Management System</div>
          </div>
        </div>

        {/* Content */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
            Abeka SDA Church — Accra, Ghana
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Manage your church
            <br />
            with confidence.
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            A complete administrative platform for tracking members, organizing ministries, and streamlining church
            operations.
          </p>
        </div>

        <div className="relative text-white/30 text-xs">
          © {new Date().getFullYear()} ABESDAC_Connect — Abeka SDA Church. All rights reserved.
        </div>
      </div>

      {/* Right panel (form) */}
      <div className="flex-1 lg:max-w-md flex items-center justify-center p-6 bg-[#F5F7FA] lg:rounded-l-3xl">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: '#f3f5fa' }}>
              <img src="/abeka.png" alt="Abeka SDA Church logo" className="h-full w-full object-contain p-1" />
            </div>
            <div className="text-[#0F2A5F] font-bold text-base">ABESDAC_Connect</div>
          </div>

          <h2 className="text-2xl font-bold text-[#0F2A5F] mb-1">Welcome back</h2>
          <p className="text-[#667085] text-sm mb-8">Sign in to your administrator account</p>

          {serverError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-[#FFF5F5] border border-[#FECDCA] text-[#D92D20] text-sm flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#344054] mb-1.5">Email address</label>
              <input
                type="email"
                placeholder="admin@abekasda.org"
                {...register('email')}
                className="w-full px-3.5 py-2.5 border border-[#E4E7EC] rounded-lg text-sm text-[#344054] placeholder-[#98A2B3] bg-white outline-none focus:border-[#1E5EFF] focus:ring-[3px] focus:ring-[#1E5EFF]/15 transition-all"
              />
              {errors.email && <p className="mt-1 text-xs text-[#D92D20]">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#344054] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full px-3.5 py-2.5 pr-10 border border-[#E4E7EC] rounded-lg text-sm text-[#344054] placeholder-[#98A2B3] bg-white outline-none focus:border-[#1E5EFF] focus:ring-[3px] focus:ring-[#1E5EFF]/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#667085]"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-[#D92D20]">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-[#1E5EFF] hover:text-[#0F2A5F] transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              style={{ background: isSubmitting ? '#667085' : '#1E5EFF' }}
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

          <div className="mt-8 pt-6 border-t border-[#E4E7EC] text-center">
            <p className="text-xs text-[#98A2B3]">
              Need access? <span className="text-[#1E5EFF] font-medium">Contact the church administrator</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
