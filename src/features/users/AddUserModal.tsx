import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { UserRole } from '@/types/database';

const addUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  role: z.enum(['administrator', 'secretary', 'pastor', 'ministry_leader']),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'pastor', label: 'Pastor' },
  { value: 'ministry_leader', label: 'Ministry Leader' },
];

interface AddUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUserModal({ open, onClose, onSuccess }: AddUserModalProps) {
  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'ministry_leader',
    },
  });

  async function onSubmit(values: AddUserFormValues) {
    try {
      // Step 1: Create auth user via Supabase Admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: values.email,
        password: values.password,
        email_confirm: true, // Auto-confirm email
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Step 2: Update the auto-created profile with additional details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: values.full_name,
          phone: values.phone || null,
          role: values.role,
          is_active: true,
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      toast.success(`User ${values.full_name} created successfully!`);
      form.reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      // Handle specific error cases
      if (err.message?.includes('already registered')) {
        toast.error('This email is already registered');
      } else if (err.message?.includes('admin api')) {
        toast.error('Admin privileges required. Please use Supabase Studio to create users.');
      } else {
        toast.error(err.message || 'Failed to create user');
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add New User">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">Add New User</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g., John Doe"
            {...form.register('full_name')}
            error={form.formState.errors.full_name?.message}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            {...form.register('email')}
            error={form.formState.errors.email?.message}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Minimum 6 characters"
            {...form.register('password')}
            error={form.formState.errors.password?.message}
            hint="User can change this after first login"
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            placeholder="e.g., +233 24 123 4567"
            {...form.register('phone')}
            error={form.formState.errors.phone?.message}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              {...form.register('role')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {form.formState.errors.role && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.role.message}</p>
            )}
          </div>

          {/* Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> The user will be able to sign in immediately with the provided email and password.
              They can update their profile and change their password after logging in.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              isLoading={form.formState.isSubmitting}
              className="flex-1"
            >
              Create User
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
