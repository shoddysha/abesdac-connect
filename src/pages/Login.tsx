import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type FormValues = z.infer<typeof schema>;

export function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass]       = useState(false);
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
      <style>{`
        /* ── Page background ── */
        .login-bg {
          min-height: 100vh;
          background: radial-gradient(ellipse at 60% 40%, #1a3a6e 0%, #0d1f3c 60%, #060e1c 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          padding: 24px 16px;
        }

        /* ── Ambient glow behind book ── */
        .book-glow {
          position: absolute;
          width: 700px;
          height: 500px;
          background: radial-gradient(ellipse, rgba(37,99,235,0.25) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
          animation: glowPulse 4s ease-in-out infinite;
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.05); }
        }

        /* ── Floating particles ── */
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        .particle {
          position: fixed;
          bottom: -8px;
          border-radius: 50%;
          background: rgba(147,197,253,0.6);
          animation: floatUp linear infinite;
          pointer-events: none;
          z-index: 0;
        }

        /* ══════════════════════════════════
           BOOK WRAPPER
        ══════════════════════════════════ */
        .book-scene {
          perspective: 1800px;
          position: relative;
          z-index: 1;
          width: min(820px, 96vw);
          /* tall enough to hold the open book */
        }

        .book {
          position: relative;
          width: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          filter: drop-shadow(0 40px 80px rgba(0,0,0,0.7));
        }

        /* ── Spine (center strip) ── */
        .book-spine {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: 28px;
          height: 100%;
          background: linear-gradient(to right, #1a2744, #2d3f6b, #1a2744);
          z-index: 10;
          border-radius: 2px;
          box-shadow: 0 0 18px rgba(0,0,0,0.6);
        }
        /* vertical line texture on spine */
        .book-spine::before {
          content: '';
          position: absolute;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          width: 2px;
          height: 80%;
          background: rgba(255,255,255,0.08);
          border-radius: 1px;
        }

        /* ══════════════════════════════════
           LEFT COVER (opens outward)
        ══════════════════════════════════ */
        .book-left {
          width: 50%;
          transform-origin: right center;
          transform-style: preserve-3d;
          animation: openLeft 1.6s cubic-bezier(.4,0,.2,1) 0.3s both;
          position: relative;
          z-index: 5;
        }
        @keyframes openLeft {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(-28deg); }
        }

        .cover-front {
          background: linear-gradient(135deg, #1e3a7a 0%, #1a2f5e 40%, #142348 100%);
          border-radius: 6px 0 0 6px;
          padding: 32px 28px;
          min-height: 520px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          backface-visibility: hidden;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.06);
          border-right: none;
        }

        /* Worn leather texture lines */
        .cover-front::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            92deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.04) 3px,
            rgba(0,0,0,0.04) 4px
          );
          pointer-events: none;
        }
        /* Gold border inset */
        .cover-front::after {
          content: '';
          position: absolute;
          inset: 12px;
          border: 1.5px solid rgba(212,175,55,0.25);
          border-radius: 4px;
          pointer-events: none;
        }

        .cover-logo {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(212,175,55,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 24px rgba(212,175,55,0.2);
          animation: logoGlow 3s ease-in-out infinite;
          z-index: 1;
        }
        @keyframes logoGlow {
          0%,100% { box-shadow: 0 0 24px rgba(212,175,55,0.2); }
          50%      { box-shadow: 0 0 40px rgba(212,175,55,0.45); }
        }

        .cover-title {
          color: rgba(212,175,55,0.9);
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-align: center;
          z-index: 1;
          text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .cover-subtitle {
          color: rgba(255,255,255,0.4);
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          text-align: center;
          z-index: 1;
        }

        /* Decorative corner ornaments */
        .corner {
          position: absolute;
          width: 28px;
          height: 28px;
          border-color: rgba(212,175,55,0.3);
          border-style: solid;
          z-index: 1;
        }
        .corner-tl { top: 20px; left: 20px; border-width: 2px 0 0 2px; border-radius: 3px 0 0 0; }
        .corner-tr { top: 20px; right: 20px; border-width: 2px 2px 0 0; border-radius: 0 3px 0 0; }
        .corner-bl { bottom: 20px; left: 20px; border-width: 0 0 2px 2px; border-radius: 0 0 0 3px; }
        .corner-br { bottom: 20px; right: 20px; border-width: 0 2px 2px 0; border-radius: 0 0 3px 0; }

        /* ══════════════════════════════════
           RIGHT PAGE (form lives here)
        ══════════════════════════════════ */
        .book-right {
          width: 50%;
          transform-origin: left center;
          transform-style: preserve-3d;
          animation: openRight 1.6s cubic-bezier(.4,0,.2,1) 0.3s both;
          position: relative;
          z-index: 5;
        }
        @keyframes openRight {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(28deg); }
        }

        .page-right {
          background: linear-gradient(160deg, #fefdf8 0%, #faf8f0 50%, #f5f2e8 100%);
          border-radius: 0 6px 6px 0;
          min-height: 520px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 36px 32px;
          backface-visibility: hidden;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.08);
          border-left: none;
        }

        /* Subtle lined paper effect */
        .page-right::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            to bottom,
            transparent,
            transparent 27px,
            rgba(37,99,235,0.05) 27px,
            rgba(37,99,235,0.05) 28px
          );
          pointer-events: none;
        }

        /* Worn page edge shadow */
        .page-right::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 18px;
          height: 100%;
          background: linear-gradient(to right, rgba(0,0,0,0.08), transparent);
          pointer-events: none;
        }

        /* ── Form entrance ── */
        @keyframes formRise {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .form-content {
          position: relative;
          z-index: 1;
          animation: formRise 0.7s ease both 1.6s;
        }

        /* ── Page bottom verse ── */
        .page-verse {
          position: absolute;
          bottom: 16px;
          left: 0; right: 0;
          text-align: center;
          font-size: 9px;
          color: rgba(0,0,0,0.2);
          font-style: italic;
          letter-spacing: 0.05em;
          z-index: 1;
          padding: 0 24px;
          animation: formRise 0.7s ease both 2s;
        }

        /* ── Input fields styled for parchment ── */
        .parchment-input {
          width: 100%;
          box-sizing: border-box;
          border: 1.5px solid rgba(37,99,235,0.2);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #1e293b;
          background: rgba(255,255,255,0.7);
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          backdrop-filter: blur(2px);
        }
        .parchment-input:focus {
          border-color: #2563eb;
          background: rgba(255,255,255,0.95);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        /* ── Sign in button ── */
        .signin-btn {
          width: 100%;
          background: linear-gradient(135deg, #1d4ed8, #1e40af);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 11px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(29,78,216,0.4);
          transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
          letter-spacing: 0.02em;
        }
        .signin-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(29,78,216,0.5);
          background: linear-gradient(135deg, #1e40af, #1d4ed8);
        }
        .signin-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(29,78,216,0.3);
        }
        .signin-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        /* ── Responsive: stack on small screens ── */
        @media (max-width: 640px) {
          .book { flex-direction: column; align-items: center; }
          .book-left  { width: 86%; transform-origin: bottom center; }
          .book-right { width: 86%; }
          .book-spine { display: none; }
          .cover-front { min-height: 180px; border-radius: 10px 10px 0 0; border: 1px solid rgba(255,255,255,0.06); flex-direction: row; padding: 20px 24px; gap: 16px; justify-content: flex-start; }
          .cover-front::after { inset: 8px; }
          .corner { display: none; }
          .cover-logo { width: 52px; height: 52px; flex-shrink: 0; }
          .cover-title { font-size: 14px; text-align: left; }
          .cover-subtitle { text-align: left; }
          .page-right { border-radius: 0 0 10px 10px; min-height: auto; padding: 28px 24px 48px; border: 1px solid rgba(0,0,0,0.08); border-top: none; }
          @keyframes openLeft  { 0%,100% { transform: rotateY(0deg); } }
          @keyframes openRight { 0%,100% { transform: rotateY(0deg); } }
        }
      `}</style>

      {/* Page background */}
      <div className="login-bg">

        {/* Ambient glow */}
        <div className="book-glow" />

        {/* Floating particles */}
        {[
          ['12%','0s','8s',3],['23%','1.5s','6s',2],['34%','0.7s','9s',4],
          ['46%','2.8s','7s',2],['57%','0.3s','10s',3],['68%','3.5s','6s',2],
          ['79%','1.1s','8s',3],['89%','2.2s','7s',2],
        ].map(([left, delay, dur, size], i) => (
          <span key={i} className="particle" style={{
            left: left as string,
            animationDelay: delay as string,
            animationDuration: dur as string,
            width: size as number,
            height: size as number,
          }} />
        ))}

        {/* ── Book scene ── */}
        <div className="book-scene">
          <div className="book">

            {/* ── LEFT COVER ── */}
            <div className="book-left">
              <div className="cover-front">
                <div className="corner corner-tl" />
                <div className="corner corner-tr" />
                <div className="corner corner-bl" />
                <div className="corner corner-br" />

                <div className="cover-logo">
                  <img src="/abeka.png" alt="Abeka SDA Church" style={{ width: 56, height: 56, objectFit: 'contain' }} />
                </div>
                <p className="cover-title">ABESDAC<br />Connect</p>
                <p className="cover-subtitle">Church Management System</p>
                <p style={{ color: 'rgba(212,175,55,0.5)', fontSize: 9, letterSpacing: '0.15em', textAlign: 'center', zIndex: 1, marginTop: 8 }}>
                  ABEKA SEVENTH-DAY<br />ADVENTIST CHURCH
                </p>
              </div>
            </div>

            {/* ── SPINE ── */}
            <div className="book-spine" />

            {/* ── RIGHT PAGE (login form) ── */}
            <div className="book-right">
              <div className="page-right">

                <div className="form-content">
                  {/* Header */}
                  <div style={{ marginBottom: 22 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                      Welcome back
                    </h2>
                    <p style={{ fontSize: 12, color: '#64748b' }}>
                      Sign in to your{' '}
                      <span style={{ color: '#2563eb', fontWeight: 600 }}>administrator account</span>
                    </p>
                  </div>

                  {/* Server error */}
                  {serverError && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      background: '#fff5f5', border: '1px solid #fecdca',
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: 12, color: '#b91c1c', marginBottom: 16,
                    }}>
                      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit(onSubmit)}>
                    {/* Email */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                        Email address
                      </label>
                      <input
                        type="email"
                        placeholder="admin@abekasda.org"
                        autoComplete="email"
                        className="parchment-input"
                        {...register('email')}
                      />
                      {errors.email && (
                        <p style={{ marginTop: 4, fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AlertCircle size={10} />{errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                        Password
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPass ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="parchment-input"
                          style={{ paddingRight: 40 }}
                          {...register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          style={{
                            position: 'absolute', right: 12, top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94a3b8', padding: 0,
                          }}
                        >
                          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {errors.password && (
                        <p style={{ marginTop: 4, fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <AlertCircle size={10} />{errors.password.message}
                        </p>
                      )}
                    </div>

                    {/* Forgot */}
                    <div style={{ textAlign: 'right', marginBottom: 18 }}>
                      <Link to="/forgot-password" style={{ fontSize: 11, color: '#2563eb', fontWeight: 500 }}>
                        Forgot password?
                      </Link>
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={isSubmitting} className="signin-btn">
                      {isSubmitting
                        ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Signing in…</>
                        : 'Sign In'
                      }
                    </button>
                  </form>

                  {/* Need access */}
                  <p style={{ marginTop: 18, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                    Need access?{' '}
                    <span style={{ color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>
                      Contact the administrator
                    </span>
                  </p>
                </div>

                {/* Scripture verse at bottom of page */}
                <p className="page-verse">
                  "I can do all things through Christ who strengthens me." — Philippians 4:13
                </p>
              </div>
            </div>

          </div>{/* /book */}

          {/* Caption below book */}
          <p style={{
            textAlign: 'center', marginTop: 20,
            fontSize: 11, color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.05em',
            animation: 'formRise 0.6s ease both 2.2s',
          }}>
            © {new Date().getFullYear()} ABESDAC_Connect · Abeka SDA Church · Built by NextGen_Developer
          </p>
        </div>

      </div>
    </>
  );
}
