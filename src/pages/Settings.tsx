import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, User, Database, Bell, Clock, Shield } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfileDetails } from '@/services/users';
import { uploadAvatar } from '@/services/storage';
import { generateFullBackup, downloadBackupFile } from '@/services/backup';
import { RestoreBackupModal } from '@/features/backup/RestoreBackupModal';


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
  const { profile, hasRole, updatePassword, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  
  // Notification settings state (load from localStorage)
  const [birthdaySmsEnabled, setBirthdaySmsEnabled] = useState(() => {
    const saved = localStorage.getItem('notif_birthday_sms');
    return saved ? saved === 'true' : true;
  });
  const [eventRemindersEnabled, setEventRemindersEnabled] = useState(() => {
    const saved = localStorage.getItem('notif_event_reminders');
    return saved ? saved === 'true' : true;
  });
  const [weeklyReportsEnabled, setWeeklyReportsEnabled] = useState(() => {
    const saved = localStorage.getItem('notif_weekly_reports');
    return saved ? saved === 'true' : false;
  });
  
  // Session timeout state (load from localStorage, default 15 minutes)
  const [idleTimeout, setIdleTimeout] = useState(() => {
    const saved = localStorage.getItem('idle_timeout_minutes');
    return saved || '15';
  });

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' },
  });

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  async function onProfileSubmit(values: ProfileValues) {
    if (!profile) return;
    try {
      let avatar_url: string | undefined;
      if (avatarFile) {
        avatar_url = await uploadAvatar(avatarFile, profile.id);
      }
      await updateProfileDetails(profile.id, { ...values, ...(avatar_url ? { avatar_url } : {}) });
      await refreshProfile();
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setAvatarFile(null);
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

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const backup = await generateFullBackup();
      downloadBackupFile(backup);
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBackupLoading(false);
    }
  }

  function handleNotificationToggle(setting: 'birthday' | 'event' | 'weekly', value: boolean) {
    switch (setting) {
      case 'birthday':
        setBirthdaySmsEnabled(value);
        localStorage.setItem('notif_birthday_sms', String(value));
        toast.success(value ? 'Birthday SMS enabled' : 'Birthday SMS disabled');
        break;
      case 'event':
        setEventRemindersEnabled(value);
        localStorage.setItem('notif_event_reminders', String(value));
        toast.success(value ? 'Event reminders enabled' : 'Event reminders disabled');
        break;
      case 'weekly':
        setWeeklyReportsEnabled(value);
        localStorage.setItem('notif_weekly_reports', String(value));
        toast.success(value ? 'Weekly reports enabled' : 'Weekly reports disabled');
        break;
    }
  }

  function handleTimeoutUpdate() {
    const timeout = parseInt(idleTimeout);
    if (isNaN(timeout) || timeout < 1) {
      toast.error('Please enter a valid timeout (minimum 1 minute)');
      return;
    }
    localStorage.setItem('idle_timeout_minutes', String(timeout));
    toast.success(`Session timeout updated to ${timeout} minutes. Changes take effect on next login.`);
  }

  function viewAuditLogs() {
    navigate('/audit-logs');
  }

  function manageUserRoles() {
    navigate('/users');
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
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50">
              Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>

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

      {hasRole('administrator', 'secretary') && (
        <Card>
          <CardHeader title="Backup & Restore" action={<Database className="h-4 w-4 text-slate-400" />} />
          <p className="mb-4 text-sm text-slate-500">
            Download a complete snapshot of every member, ministry, attendance record, event, announcement, user, and
            audit log as one JSON file — useful to keep a periodic copy outside the app.
          </p>
          <Button onClick={handleBackup} isLoading={backupLoading}>
            Download full backup
          </Button>
          <Button variant="outline" className="ml-2" onClick={() => setRestoreOpen(true)}>
            Restore from backup
          </Button>
        </Card>
      )}

      <RestoreBackupModal open={restoreOpen} onClose={() => setRestoreOpen(false)} />

      {hasRole('administrator') && (
        <Card>
          <CardHeader title="System notifications" action={<Bell className="h-4 w-4 text-slate-400" />} />
          <p className="mb-4 text-sm text-slate-500">
            Configure automated reminders and notifications for birthdays, events, and follow-ups.
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary" 
                checked={birthdaySmsEnabled}
                onChange={(e) => handleNotificationToggle('birthday', e.target.checked)}
              />
              <span className="text-sm text-ink">Send birthday SMS to members automatically</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary" 
                checked={eventRemindersEnabled}
                onChange={(e) => handleNotificationToggle('event', e.target.checked)}
              />
              <span className="text-sm text-ink">Event reminder notifications (24 hours before)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary" 
                checked={weeklyReportsEnabled}
                onChange={(e) => handleNotificationToggle('weekly', e.target.checked)}
              />
              <span className="text-sm text-ink">Weekly attendance summary reports</span>
            </label>
          </div>
        </Card>
      )}

      {hasRole('administrator') && (
        <Card>
          <CardHeader title="Session timeout" action={<Clock className="h-4 w-4 text-slate-400" />} />
          <p className="mb-4 text-sm text-slate-500">
            Automatically log out users after a period of inactivity for security.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 max-w-xs">
              <Input
                type="number"
                label="Idle timeout (minutes)"
                value={idleTimeout}
                onChange={(e) => setIdleTimeout(e.target.value)}
                hint="Minimum 1 minute, recommended 15 minutes"
              />
            </div>
            <Button onClick={handleTimeoutUpdate}>Update timeout</Button>
          </div>
        </Card>
      )}

      {hasRole('administrator') && (
        <Card>
          <CardHeader title="Audit & security" action={<Shield className="h-4 w-4 text-slate-400" />} />
          <p className="mb-4 text-sm text-slate-500">
            View security logs, manage user permissions, and configure data retention policies.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={viewAuditLogs}>View audit logs</Button>
            <Button variant="outline" onClick={manageUserRoles}>Manage user roles</Button>
          </div>
        </Card>
      )}

      <Card className="flex items-center gap-3">
        <img src="/abeka.png" alt="Abeka SDA Church logo" className="h-8 w-8 rounded-md object-contain" />
        <div>
          <p className="text-sm font-medium text-ink">ABESDAC_Connect</p>
          <p className="text-xs text-slate-500">Church management system for Abeka SDA Church · v1.0.0</p>
        </div>
      </Card>
    </div>
  );
}