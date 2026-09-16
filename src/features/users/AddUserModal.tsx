import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { UserPlus, AlertCircle, Info } from 'lucide-react';
import type { UserRole } from '@/types/database';

const addUserSchema = z.object({
  email:     z.string().email('Enter a valid email address'),
  password:  z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  phone:     z.string().optional(),
  role:      z.enum(['administrator', 'secretary', 'pastor', 'ministry_leader']),
});

type FormValues = z.infer<typeof addUserSchema>;

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'administrator',   label: 'Administrator',   desc: 'Full access to all features' },
  { value: 'secretary',       label: 'Secretary',        desc: 'Manage members, events & SMS' },
  { value: 'pastor',          label: 'Pastor',           desc: 'View reports & prayer requests' },
  { value: 'ministry_leader', label: 'Ministry Leader',  desc: 'Manage own ministry & reports' },
];

interface AddUserModalProps {
  open:      boolean;
  onClose:   () => void;
  onSuccess: () => void;
}

export function AddUserModal({ open, onClose, onSuccess }: AddUserModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: '', password: '', full_name: '', phone: '', role: 'ministry_leader' },
  });

  const selectedRole = form.watch('role');

  function handleClose() {
    form.reset();
    onClose();
  }

  async function onSubmit(values: FormValues) {
    try {
      // Get the current session token to pass to the Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('You must be signed in to add users.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email:     values.email,
          password:  values.password,
          full_name: values.full_name,
          phone:     values.phone || null,
          role:      values.role,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        // Show the full error detail so we can diagnose it
        const msg = result.error || 'Failed to create user';
        const detail = result.detail ? ` (${JSON.stringify(result.detail)})` : '';
        throw new Error(msg + detail);
      }

      toast.success(`${values.full_name} has been added. They can log in immediately.`);
      form.reset();
      onSuccess();
      handleClose();

    } catch (err: any) {
      toast.error(err.message || 'Failed to create user. Please try again.');
    }
  }

  const roleInfo = ROLE_OPTIONS.find(r => r.value === selectedRole);

  return (
    <Modal open={open} onClose={handleClose} title="Add New User" size="lg">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            placeholder="e.g., Kwame Mensah"
            {...form.register('full_name')}
            error={form.formState.errors.full_name?.message}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="kwame@example.com"
            {...form.register('email')}
            error={form.formState.errors.email?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Temporary Password"
            type="password"
            placeholder="Min. 6 characters"
            {...form.register('password')}
            error={form.formState.errors.password?.message}
          />
          <Input
            label="Phone (Optional)"
            type="tel"
            placeholder="+233 24 123 4567"
            {...form.register('phone')}
            error={form.formState.errors.phone?.message}
          />
        </div>

        {/* Role selector */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedRole === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  {...form.register('role')}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className={`text-sm font-semibold ${selectedRole === opt.value ? 'text-blue-700' : 'text-slate-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          {form.formState.errors.role && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {form.formState.errors.role.message}
            </p>
          )}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            The user will be created as <strong>{roleInfo?.label}</strong> and can
            sign in immediately with the email and password you set here.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={form.formState.isSubmitting} className="flex-1">
            <UserPlus className="h-4 w-4" />
            {form.formState.isSubmitting ? 'Creating…' : 'Add User'}
          </Button>
        </div>

      </form>
    </Modal>
  );
}
