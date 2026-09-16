import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { UserPlus, AlertCircle, CheckCircle, Info } from 'lucide-react';
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
  { value: 'administrator',  label: 'Administrator',   desc: 'Full access to all features' },
  { value: 'secretary',      label: 'Secretary',        desc: 'Manage members, events & SMS' },
  { value: 'pastor',         label: 'Pastor',           desc: 'View reports & prayer requests' },
  { value: 'ministry_leader',label: 'Ministry Leader',  desc: 'Manage own ministry & reports' },
];

interface AddUserModalProps {
  open:      boolean;
  onClose:   () => void;
  onSuccess: () => void;
}

// ── Strategy 1: RPC function (preferred) ────────────────────────────────────
async function createViaRpc(values: FormValues) {
  const { data, error } = await supabase.rpc('create_new_user', {
    p_email:     values.email,
    p_password:  values.password,
    p_full_name: values.full_name,
    p_phone:     values.phone || null,
    p_role:      values.role,
  });
  if (error) throw error;

  // RPC returned null or empty object — means the function exists but the
  // auth.users insert silently failed (service role required for that table).
  // Treat as "function not available" and fall through to the signUp strategy.
  if (!data || (typeof data === 'object' && !('user_id' in data))) {
    throw Object.assign(new Error('RPC returned no user_id'), { code: 'PGRST202' });
  }

  return data;
}

// ── Strategy 2: signUp + profile upsert (fallback) ───────────────────────────
async function createViaSignUp(values: FormValues) {
  const { data, error } = await supabase.auth.signUp({
    email:    values.email,
    password: values.password,
    options: {
      data: { full_name: values.full_name },
      emailRedirectTo: undefined,
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('User creation returned no user object');

  // Supabase returns a fake user object with empty identities when the email
  // is already registered (instead of throwing an error). Detect and surface it.
  if (data.user.identities && data.user.identities.length === 0) {
    throw new Error('A user with that email address already exists.');
  }

  const userId = data.user.id;

  // Upsert the profile with the correct role
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id:         userId,
      email:      values.email,
      full_name:  values.full_name,
      phone:      values.phone || null,
      role:       values.role,
      is_active:  true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (profileError) throw profileError;

  return { success: true, user_id: userId, note: 'signup' };
}

export function AddUserModal({ open, onClose, onSuccess }: AddUserModalProps) {
  const [method, setMethod] = useState<'rpc' | 'signup' | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: '', password: '', full_name: '', phone: '', role: 'ministry_leader',
    },
  });

  const selectedRole = form.watch('role');

  function handleClose() {
    form.reset();
    setMethod(null);
    onClose();
  }

  async function onSubmit(values: FormValues) {
    try {
      // Try RPC first
      try {
        await createViaRpc(values);
        setMethod('rpc');
        toast.success(`✅ ${values.full_name} has been added. They can log in immediately.`);
        form.reset();
        onSuccess();
        handleClose();
        return;
      } catch (rpcErr: any) {
        // If the function simply doesn't exist, fall through to signUp
        const isNotFound =
          rpcErr?.message?.includes('does not exist') ||
          rpcErr?.message?.includes('function') ||
          rpcErr?.code === 'PGRST202' ||
          rpcErr?.code === '42883';

        if (!isNotFound) {
          // It's a real error (duplicate email, invalid role, etc.) — surface it
          throw rpcErr;
        }
        // Function not deployed — fall through to signUp strategy
      }

      // Fallback: signUp strategy
      const result = await createViaSignUp(values);
      setMethod('signup');
      toast.success(
        `✅ ${values.full_name} has been added. They need to confirm their email before signing in.`,
        { duration: 6000 }
      );
      form.reset();
      onSuccess();
      handleClose();

    } catch (err: any) {
      console.error('AddUser error:', err);

      const msg: string = err?.message || '';

      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('That email address is already registered.');
      } else if (msg.includes('Invalid role')) {
        toast.error('Invalid role selected.');
      } else if (msg.includes('permission') || msg.includes('not authorized')) {
        toast.error('Permission denied — only administrators can add users.');
      } else if (msg.includes('email') && msg.includes('confirmation')) {
        // signUp succeeded but email confirmation required — still show success
        toast.success(`${values.full_name} added. A confirmation email has been sent.`);
        form.reset();
        onSuccess();
        handleClose();
      } else {
        toast.error(msg || 'Failed to create user. Please try again.');
      }
    }
  }

  const roleInfo = ROLE_OPTIONS.find(r => r.value === selectedRole);

  return (
    <Modal open={open} onClose={handleClose} title="Add New User" size="lg">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* Two-column: name + email */}
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

        {/* Two-column: password + phone */}
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
            The user will be created with the <strong>{roleInfo?.label}</strong> role.
            They can sign in with their email and password immediately after being added.
            They can update their password from the Settings page.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={form.formState.isSubmitting}
            className="flex-1"
          >
            <UserPlus className="h-4 w-4" />
            {form.formState.isSubmitting ? 'Creating…' : 'Add User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
