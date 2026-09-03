import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, User, Database, Bell, Clock, Shield, Download, Mail, Building2, Palette } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfileDetails } from '@/services/users';
import { uploadAvatar } from '@/services/storage';
import { generateFullBackup, downloadBackupFile } from '@/services/backup';
import { RestoreBackupModal } from '@/features/backup/RestoreBackupModal';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { supabase } from '@/lib/supabase';

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

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  confirmEmail: z.string().email('Invalid email address'),
}).refine((d) => d.email === d.confirmEmail, { message: 'Emails do not match', path: ['confirmEmail'] });
type EmailValues = z.infer<typeof emailSchema>;

const churchSettingsSchema = z.object({
  church_name: z.string().min(1, 'Required'),
  church_code: z.string().min(1, 'Required'),
  pastor_name: z.string().optional(),
  head_elder_name: z.string().optional(),
  established_year: z.string().optional(),
  conference: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
});
type ChurchSettingsValues = z.infer<typeof churchSettingsSchema>;

type TabType = 'church' | 'profile' | 'notifications' | 'security' | 'backup';

export function Settings() {
  const { profile, hasRole, updatePassword, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('church');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [churchEditMode, setChurchEditMode] = useState(false);

  // Fetch church settings
  const churchSettingsQuery = useQuery({
    queryKey: ['church-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('church_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  useRealtimeQuery('church_settings', ['church-settings']);

  // Fetch user preferences from database with real-time updates
  const preferencesQuery = useQuery({
    queryKey: ['user-preferences', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences, display_preferences')
        .eq('id', profile.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  useRealtimeQuery('profiles', ['user-preferences', profile?.id]);

  // Initialize preferences state from database
  const [notificationPrefs, setNotificationPrefs] = useState({
    task_assigned: true,
    task_completed: true,
    report_due: true,
    report_submitted: true,
    event_reminder: true,
    birthday_reminder: true,
    member_followup: true,
    ministry_update: true,
  });

  const [displayPrefs, setDisplayPrefs] = useState({
    theme: 'light',
    items_per_page: 10,
    date_format: 'MMM d, yyyy',
  });

  // Update state when preferences load from database
  useEffect(() => {
    if (preferencesQuery.data) {
      setNotificationPrefs(preferencesQuery.data.notification_preferences || notificationPrefs);
      setDisplayPrefs(preferencesQuery.data.display_preferences || displayPrefs);
    }
  }, [preferencesQuery.data]);

  // Session timeout
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
  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });
  
  const churchSettingsForm = useForm<ChurchSettingsValues>({
    resolver: zodResolver(churchSettingsSchema),
    defaultValues: churchSettingsQuery.data || {},
  });

  // Update church form when data loads
  useEffect(() => {
    if (churchSettingsQuery.data) {
      churchSettingsForm.reset(churchSettingsQuery.data);
    }
  }, [churchSettingsQuery.data]);

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

  async function onEmailSubmit(values: EmailValues) {
    try {
      const { error } = await supabase.auth.updateUser({ email: values.email });
      if (error) throw error;
      toast.success('Verification email sent! Please check your inbox.');
      emailForm.reset();
    } catch (err) {
      toast.error((err as Error).message);
    }
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

  function handleTimeoutUpdate() {
    const timeout = parseInt(idleTimeout);
    if (isNaN(timeout) || timeout < 1) {
      toast.error('Please enter a valid timeout (minimum 1 minute)');
      return;
    }
    localStorage.setItem('idle_timeout_minutes', String(timeout));
    toast.success(`Session timeout updated to ${timeout} minutes`);
  }

  async function updateNotificationPreference(key: string, value: boolean) {
    if (!profile?.id) return;
    const updated = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(updated);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: updated,
          updated_preferences_at: new Date().toISOString()
        })
        .eq('id', profile.id);
      if (error) throw error;
      toast.success('Notification preference updated');
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    } catch (err) {
      toast.error((err as Error).message);
      // Revert on error
      setNotificationPrefs(notificationPrefs);
    }
  }

  async function updateDisplayPreference(key: string, value: any) {
    if (!profile?.id) return;
    const updated = { ...displayPrefs, [key]: value };
    setDisplayPrefs(updated);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_preferences: updated,
          updated_preferences_at: new Date().toISOString()
        })
        .eq('id', profile.id);
      if (error) throw error;
      toast.success('Display preference updated');
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    } catch (err) {
      toast.error((err as Error).message);
      // Revert on error
      setDisplayPrefs(displayPrefs);
    }
  }

  async function downloadMyData() {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();
      if (error) throw error;
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-profile-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Profile data downloaded');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function viewAuditLogs() {
    navigate('/audit-logs');
  }

  async function onChurchSettingsSubmit(values: ChurchSettingsValues) {
    if (!hasRole('administrator')) {
      toast.error('Only administrators can update church settings');
      return;
    }

    try {
      const { error } = await supabase
        .from('church_settings')
        .update({
          ...values,
          updated_by: profile?.id,
        })
        .eq('id', churchSettingsQuery.data?.id);

      if (error) throw error;

      toast.success('Church settings updated successfully');
      setChurchEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['church-settings'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'church', label: 'Church Info', icon: <Building2 className="h-4 w-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="h-4 w-4" /> },
    { id: 'backup', label: 'Backup', icon: <Database className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage church system preferences and configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Church Info Tab */}
      {activeTab === 'church' && (
        <div className="space-y-6">
          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Church Information</h2>
                <p className="text-sm text-slate-500 mt-1">Basic information about your church</p>
              </div>
              {hasRole('administrator') && !churchEditMode && (
                <Button
                  variant="outline"
                  onClick={() => setChurchEditMode(true)}
                  className="text-sm"
                >
                  Edit
                </Button>
              )}
            </div>
            
            {churchSettingsQuery.isLoading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-10 bg-slate-200 rounded"></div>
                  <div className="h-10 bg-slate-200 rounded"></div>
                </div>
              </div>
            ) : churchEditMode ? (
              <form onSubmit={churchSettingsForm.handleSubmit(onChurchSettingsSubmit)} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Church Name"
                    {...churchSettingsForm.register('church_name')}
                    error={churchSettingsForm.formState.errors.church_name?.message}
                  />
                  <Input
                    label="Church Code"
                    {...churchSettingsForm.register('church_code')}
                    error={churchSettingsForm.formState.errors.church_code?.message}
                  />
                  <Input
                    label="Pastor"
                    {...churchSettingsForm.register('pastor_name')}
                    placeholder="e.g., Pastor Emmanuel Asare"
                  />
                  <Input
                    label="Head Elder"
                    {...churchSettingsForm.register('head_elder_name')}
                    placeholder="e.g., Elder Kofi Mensah"
                  />
                  <Input
                    label="Established Year"
                    {...churchSettingsForm.register('established_year')}
                    placeholder="e.g., 1985"
                  />
                  <Input
                    label="Conference"
                    {...churchSettingsForm.register('conference')}
                    placeholder="e.g., Ghana Union Conference"
                  />
                  <Input
                    label="Church Phone"
                    {...churchSettingsForm.register('phone')}
                    placeholder="e.g., +233 XXX XXX XXX"
                  />
                  <Input
                    label="Church Email"
                    type="email"
                    {...churchSettingsForm.register('email')}
                    error={churchSettingsForm.formState.errors.email?.message}
                    placeholder="e.g., info@abekasda.org"
                  />
                  <Input
                    label="Website"
                    {...churchSettingsForm.register('website')}
                    placeholder="e.g., https://abekasda.org"
                  />
                  <div className="md:col-span-2">
                    <Input
                      label="Church Address"
                      {...churchSettingsForm.register('address')}
                      placeholder="e.g., Abeka Lapaz, Accra, Ghana"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setChurchEditMode(false);
                      churchSettingsForm.reset(churchSettingsQuery.data);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={churchSettingsForm.formState.isSubmitting}>
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Church Name</label>
                    <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                      {churchSettingsQuery.data?.church_name || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Church Code</label>
                    <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                      {churchSettingsQuery.data?.church_code || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Pastor</label>
                    <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                      {churchSettingsQuery.data?.pastor_name || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Head Elder</label>
                    <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                      {churchSettingsQuery.data?.head_elder_name || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Established</label>
                    <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                      {churchSettingsQuery.data?.established_year || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Conference</label>
                    <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                      {churchSettingsQuery.data?.conference || '—'}
                    </div>
                  </div>
                  {churchSettingsQuery.data?.phone && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Church Phone</label>
                      <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                        {churchSettingsQuery.data.phone}
                      </div>
                    </div>
                  )}
                  {churchSettingsQuery.data?.email && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Church Email</label>
                      <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                        {churchSettingsQuery.data.email}
                      </div>
                    </div>
                  )}
                  {churchSettingsQuery.data?.website && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Website</label>
                      <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                        <a href={churchSettingsQuery.data.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {churchSettingsQuery.data.website}
                        </a>
                      </div>
                    </div>
                  )}
                  {churchSettingsQuery.data?.address && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Church Address</label>
                      <div className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                        {churchSettingsQuery.data.address}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* System Version */}
          <Card className="flex items-center gap-3 bg-white">
            <img src="/abeka.png" alt="Abeka SDA Church logo" className="h-10 w-10 rounded-md object-contain" />
            <div>
              <p className="text-sm font-semibold text-slate-900">ABESDAC_Connect</p>
              <p className="text-xs text-slate-500">Church management system for Abeka SDA Church · v4.1.0</p>
            </div>
          </Card>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Your Profile</h2>
              <p className="text-sm text-slate-500 mt-1">Update your personal information and avatar</p>
            </div>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 border-2 border-slate-200">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-slate-400" />
                  )}
                </div>
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                    Upload photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">JPG, PNG or GIF. Max size 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Full name" 
                  {...profileForm.register('full_name')} 
                  error={profileForm.formState.errors.full_name?.message} 
                />
                <Input label="Phone" {...profileForm.register('phone')} />
                <Input label="Email address" value={profile?.email ?? ''} disabled />
                <Input label="Role" value={profile?.role.replace('_', ' ') ?? ''} disabled />
              </div>

              <Button type="submit" isLoading={profileForm.formState.isSubmitting}>
                Save changes
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Notification Preferences</h2>
              <p className="text-sm text-slate-500 mt-1">Choose which notifications you want to receive</p>
            </div>
            <div className="p-6 space-y-4">
              {hasRole('ministry_leader') && (
                <>
                  <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="text-sm text-slate-900 font-medium">Task assignments</span>
                      <p className="text-xs text-slate-500 mt-0.5">Get notified when you're assigned a task</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={notificationPrefs.task_assigned}
                      onChange={(e) => updateNotificationPreference('task_assigned', e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="text-sm text-slate-900 font-medium">Task completions</span>
                      <p className="text-xs text-slate-500 mt-0.5">Get notified when tasks are completed</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={notificationPrefs.task_completed}
                      onChange={(e) => updateNotificationPreference('task_completed', e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="text-sm text-slate-900 font-medium">Report due reminders</span>
                      <p className="text-xs text-slate-500 mt-0.5">Remind me when reports are due</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={notificationPrefs.report_due}
                      onChange={(e) => updateNotificationPreference('report_due', e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="text-sm text-slate-900 font-medium">Report submissions</span>
                      <p className="text-xs text-slate-500 mt-0.5">Get notified when reports are submitted</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={notificationPrefs.report_submitted}
                      onChange={(e) => updateNotificationPreference('report_submitted', e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="text-sm text-slate-900 font-medium">Member follow-ups</span>
                      <p className="text-xs text-slate-500 mt-0.5">Notify when follow-ups are due</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={notificationPrefs.member_followup}
                      onChange={(e) => updateNotificationPreference('member_followup', e.target.checked)}
                    />
                  </label>
                </>
              )}
              <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                <div>
                  <span className="text-sm text-slate-900 font-medium">Event reminders</span>
                  <p className="text-xs text-slate-500 mt-0.5">Get notified about upcoming events</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={notificationPrefs.event_reminder}
                  onChange={(e) => updateNotificationPreference('event_reminder', e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                <div>
                  <span className="text-sm text-slate-900 font-medium">Birthday reminders</span>
                  <p className="text-xs text-slate-500 mt-0.5">Get notified about member birthdays</p>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={notificationPrefs.birthday_reminder}
                  onChange={(e) => updateNotificationPreference('birthday_reminder', e.target.checked)}
                />
              </label>
              {hasRole('administrator', 'secretary', 'ministry_leader') && (
                <label className="flex items-center justify-between cursor-pointer group p-4 rounded-lg hover:bg-slate-50 transition-colors">
                  <div>
                    <span className="text-sm text-slate-900 font-medium">Ministry updates</span>
                    <p className="text-xs text-slate-500 mt-0.5">Get notified about ministry changes</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={notificationPrefs.ministry_update}
                    onChange={(e) => updateNotificationPreference('ministry_update', e.target.checked)}
                  />
                </label>
              )}
            </div>
          </Card>

          {/* Display Preferences */}
          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Display Preferences</h2>
              <p className="text-sm text-slate-500 mt-1">Customize how information is displayed</p>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Items per page</label>
                <select
                  value={displayPrefs.items_per_page}
                  onChange={(e) => updateDisplayPreference('items_per_page', parseInt(e.target.value))}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                >
                  <option value={5}>5 items</option>
                  <option value={10}>10 items</option>
                  <option value={25}>25 items</option>
                  <option value={50}>50 items</option>
                  <option value={100}>100 items</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date format</label>
                <select
                  value={displayPrefs.date_format}
                  onChange={(e) => updateDisplayPreference('date_format', e.target.value)}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                >
                  <option value="MMM d, yyyy">Jan 15, 2024</option>
                  <option value="dd/MM/yyyy">15/01/2024</option>
                  <option value="MM/dd/yyyy">01/15/2024</option>
                  <option value="yyyy-MM-dd">2024-01-15</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Data & Privacy */}
          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Data & Privacy</h2>
              <p className="text-sm text-slate-500 mt-1">Download your personal data</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Download a JSON file containing all your profile information, preferences, and activity.
              </p>
              <Button variant="outline" onClick={downloadMyData}>
                <Download className="h-4 w-4" />
                Download my data
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Change Email</h2>
              <p className="text-sm text-slate-500 mt-1">Update your email address</p>
            </div>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="New email"
                  type="email"
                  {...emailForm.register('email')}
                  error={emailForm.formState.errors.email?.message}
                  placeholder="your.new.email@example.com"
                />
                <Input
                  label="Confirm new email"
                  type="email"
                  {...emailForm.register('confirmEmail')}
                  error={emailForm.formState.errors.confirmEmail?.message}
                  placeholder="your.new.email@example.com"
                />
              </div>
              <Button type="submit" isLoading={emailForm.formState.isSubmitting}>
                Update email
              </Button>
            </form>
          </Card>

          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
              <p className="text-sm text-slate-500 mt-1">Update your account password</p>
            </div>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="New password"
                  type="password"
                  {...passwordForm.register('password')}
                  error={passwordForm.formState.errors.password?.message}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  {...passwordForm.register('confirmPassword')}
                  error={passwordForm.formState.errors.confirmPassword?.message}
                />
              </div>
              <Button type="submit" isLoading={passwordForm.formState.isSubmitting}>
                Update password
              </Button>
            </form>
          </Card>

          {hasRole('administrator') && (
            <>
              <Card className="bg-white">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Session Timeout</h2>
                  <p className="text-sm text-slate-500 mt-1">Auto-logout after inactivity</p>
                </div>
                <div className="p-6 space-y-4">
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
                </div>
              </Card>

              <Card className="bg-white">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="text-lg font-semibold text-slate-900">Admin Quick Actions</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage users and view system activity</p>
                </div>
                <div className="p-6 space-y-3">
                  <Button variant="outline" onClick={viewAuditLogs} className="w-full sm:w-auto">
                    View Audit Logs
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Backup Tab */}
      {activeTab === 'backup' && hasRole('administrator', 'secretary') && (
        <div className="space-y-6">
          <Card className="bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Backup & Restore</h2>
              <p className="text-sm text-slate-500 mt-1">Download complete system backup or restore from file</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Download a complete snapshot of every member, ministry, attendance record, event, announcement, user, and
                audit log as one JSON file.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleBackup} isLoading={backupLoading}>
                  <Download className="h-4 w-4" />
                  Download full backup
                </Button>
                <Button variant="outline" onClick={() => setRestoreOpen(true)}>
                  Restore from backup
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <RestoreBackupModal open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </div>
  );
}
