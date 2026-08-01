import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Church, KeyRound, User } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfileDetails } from '@/services/users';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Required'),
  phone: z.string().optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type PasswordValues = z.infer<typeof passwordSchema>;

export function Settings() {
  const { profile, updatePassword } = useAuth();
  const queryClient = useQueryClient();

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' },
  });

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  async function onProfileSubmit(values: ProfileValues) {
    if (!profile) return;
    try {
      await updateProfileDetails(profile.id, values);
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onPasswordSubmit(values: PasswordValues) {
    const { error } = await updatePassword(values.password);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Password updated');
    passwordForm.reset();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account and app information.</p>
      </div>

      <Card>
        <CardHeader title="Your profile" action={<User className="h-4 w-4 text-slate-400" />} />
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <Input label="Full name" {...profileForm.register('full_name')} error={profileForm.formState.errors.full_name?.message} />
          <Input label="Phone" {...profileForm.register('phone')} />
          <Input label="Email" value={profile?.email ?? ''} disabled hint="Contact an administrator to change your email." />
          <Input label="Role" value={profile?.role.replace('_', ' ') ?? ''} disabled />
          <Button type="submit" isLoading={profileForm.formState.isSubmitting}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Change password" action={<KeyRound className="h-4 w-4 text-slate-400" />} />
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <Input label="New password" type="password" {...passwordForm.register('password')} error={passwordForm.formState.errors.password?.message} />
          <Input
            label="Confirm new password"
            type="password"
            {...passwordForm.register('confirmPassword')}
            error={passwordForm.formState.errors.confirmPassword?.message}
          />
          <Button type="submit" isLoading={passwordForm.formState.isSubmitting}>
            Update password
          </Button>
        </form>
      </Card>

      <Card className="flex items-center gap-3">
        <Church className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-medium text-ink">ABESDAC_Connect</p>
          <p className="text-xs text-slate-500">Church management system for Abeka SDA Church · v1.0.0</p>
        </div>
      </Card>
    </div>
  );
}
