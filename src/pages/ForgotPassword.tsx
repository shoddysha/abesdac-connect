import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
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
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200">
            <img src="public/abeka.png" alt="Abeka SDA Church logo" className="h-full w-full object-contain p-1.5" />
          </div>
          <h1 className="text-xl font-bold text-ink">Reset your password</h1>
          <p className="text-sm text-slate-500">We'll email you a secure reset link</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-card p-6 shadow-card">
          {sent ? (
            <div className="text-center">
              <Mail className="mx-auto mb-3 h-10 w-10 text-secondary" />
              <p className="font-medium text-ink">Check your inbox</p>
              <p className="mt-1 text-sm text-slate-500">
                If that email is registered, a reset link is on its way.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
              )}
              <Input label="Email address" type="email" placeholder="you@abekasda.org" {...register('email')} error={errors.email?.message} />
              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                Send reset link
              </Button>
            </form>
          )}
        </div>
        <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-secondary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      </div>
    </div>
  );
}