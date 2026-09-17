import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Pin, Megaphone, MessageSquare,
  Eye, Archive, Calendar, User, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import {
  fetchAnnouncementsWithViewStatus,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAnnouncementAsViewed,
} from '@/services/announcements';
import { SendSmsModal } from '@/features/sms/SendSmsModal';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import type { Announcement } from '@/types/database';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Message is required'),
  status: z.enum(['published', 'draft']),
  is_pinned: z.boolean().optional(),
  expires_at: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type TabFilter = 'all' | 'published' | 'draft' | 'archived';

// Status badge config
const statusConfig: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
  draft:     { label: 'Draft',     className: 'bg-slate-100 text-slate-600' },
  archived:  { label: 'Archived',  className: 'bg-orange-100 text-orange-600' },
};

export function Announcements() {
  const [searchParams] = useSearchParams();
  const { hasRole, profile } = useAuth();
  const canCreate = hasRole('administrator', 'secretary', 'ministry_leader', 'pastor');
  const canManage = hasRole('administrator', 'secretary');
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingAnnouncement, setViewingAnnouncement] = useState<Announcement | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [selectedAnnouncementForSms, setSelectedAnnouncementForSms] = useState<Announcement | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const query = useQuery({
    queryKey: ['announcements-with-views'],
    queryFn: fetchAnnouncementsWithViewStatus,
  });
  useRealtimeQuery('announcements', ['announcements-with-views']);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'published' },
  });

  const watchStatus = watch('status');

  const allAnnouncements = query.data ?? [];

  // Tab counts
  const counts = useMemo(() => ({
    all: allAnnouncements.length,
    published: allAnnouncements.filter(a => (a.status ?? 'published') === 'published').length,
    draft: allAnnouncements.filter(a => a.status === 'draft').length,
    archived: allAnnouncements.filter(a => a.status === 'archived').length,
  }), [allAnnouncements]);

  // Filtered list
  const announcements = useMemo(() => {
    if (activeTab === 'all') return allAnnouncements;
    return allAnnouncements.filter(a => (a.status ?? 'published') === activeTab);
  }, [allAnnouncements, activeTab]);

  const publishedCount = counts.published;

  function canManageAnnouncement(a: Announcement) {
    return canManage || 
      ((profile?.role === 'ministry_leader' || profile?.role === 'pastor') && a.created_by === profile.id);
  }

  function openCreate() {
    reset({ title: '', body: '', status: 'published', is_pinned: false, expires_at: '' });
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(a: Announcement) {
    if (!canManageAnnouncement(a)) return;
    reset({
      title: a.title,
      body: a.body,
      status: (a.status as 'published' | 'draft') ?? 'published',
      is_pinned: a.is_pinned,
      expires_at: a.expires_at?.slice(0, 10) ?? '',
    });
    setEditingId(a.id);
    setFormOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        ...values,
        expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
        ...(editingId ? {} : { created_by: profile?.id }),
        // Set published_at only when publishing
        ...(values.status === 'published' && !editingId
          ? { published_at: new Date().toISOString() }
          : {}),
      };
      if (editingId) {
        await updateAnnouncement(editingId, payload as any);
        toast.success('Announcement updated');
      } else {
        await createAnnouncement(payload as any);
        toast.success(values.status === 'draft' ? 'Saved as draft' : 'Announcement published');
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(a: Announcement) {
    if (!canManageAnnouncement(a)) return;
    if (!confirm('Delete this announcement?')) return;
    await deleteAnnouncement(a.id);
    toast.success('Announcement deleted');
    queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] });
  }

  async function handleArchive(a: Announcement) {
    if (!canManageAnnouncement(a)) return;
    await updateAnnouncement(a.id, { status: 'archived' } as any);
    toast.success('Announcement archived');
    queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] });
  }

  async function togglePin(a: Announcement) {
    if (!canManageAnnouncement(a)) return;
    await updateAnnouncement(a.id, { is_pinned: !a.is_pinned });
    queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] });
  }

  function openSmsModal(a: Announcement) {
    setSelectedAnnouncementForSms(a);
    setSmsModalOpen(true);
  }

  const tabs: { value: TabFilter; label: string }[] = [
    { value: 'all',       label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'draft',     label: 'Draft' },
    { value: 'archived',  label: 'Archived' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500 mt-1">
            {publishedCount} published announcement{publishedCount !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="flex-shrink-0">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {/* ── Tab Filter Bar ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
              activeTab === tab.value
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            {tab.label}
            {counts[tab.value] > 0 && tab.value !== 'all' && (
              <span className={cn(
                'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                activeTab === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              )}>
                {counts[tab.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── List ────────────────────────────────────────────────── */}
      {query.isLoading ? (
        <Spinner />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={activeTab === 'all' ? 'No announcements yet' : `No ${activeTab} announcements`}
          description={canCreate ? "Click '+ New Announcement' to get started." : 'Nothing here yet.'}
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const status = a.status ?? 'published';
            const sc = statusConfig[status] ?? statusConfig.published;
            const isUnread = !a.has_viewed && status === 'published';

            return (
              <div
                key={a.id}
                className={cn(
                  'bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow',
                  isUnread ? 'border-purple-300' : 'border-slate-200'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                    status === 'published' ? 'bg-red-50' : 'bg-slate-100'
                  )}>
                    <AlertCircle className={cn(
                      'h-5 w-5',
                      status === 'published' ? 'text-red-500' : 'text-slate-400'
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Status badges row */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', sc.className)}>
                        {sc.label}
                      </span>
                      {a.is_pinned && (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Pinned
                        </span>
                      )}
                      {isUnread && (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          New
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-slate-900 text-base mb-1">{a.title}</h3>

                    {/* Body preview */}
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{a.body}</p>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(a.published_at), 'd MMM yyyy')}
                      </span>
                      {a.created_by && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          By {profile?.role === 'administrator' ? 'Administration' : 'Leader'}
                        </span>
                      )}
                      {canManage && a.view_count !== undefined && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {a.view_count} view{a.view_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action icons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Mark viewed */}
                    {isUnread && (
                      <button
                        onClick={() => markAnnouncementAsViewed(a.id).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] });
                          queryClient.invalidateQueries({ queryKey: ['notification-counts'] });
                        })}
                        className="p-2 rounded-lg text-purple-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                        title="Mark as read"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}

                    {canManageAnnouncement(a) && (
                      <>
                        {/* View full */}
                        <button
                          onClick={() => setViewingAnnouncement(a)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openEdit(a)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {/* Archive (only published) */}
                        {status !== 'archived' && (
                          <button
                            onClick={() => handleArchive(a)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-orange-50 hover:text-orange-500 transition-colors"
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(a)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Announcement' : 'New Announcement'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g., End of Term Examinations"
            {...register('title')}
            error={errors.title?.message}
          />

          <Textarea
            label="Message"
            rows={6}
            placeholder="Write your announcement here..."
            {...register('body')}
            error={errors.body?.message}
          />

          <Input
            label="Expires on (optional)"
            type="date"
            {...register('expires_at')}
          />

          {/* Pin toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register('is_pinned')}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Pin to top
          </label>

          {/* Publish vs Draft selector */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Status</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue('status', 'published')}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition-all',
                  watchStatus === 'published'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <Megaphone className={cn('h-5 w-5', watchStatus === 'published' ? 'text-green-600' : 'text-slate-400')} />
                <span className={cn('text-sm font-semibold', watchStatus === 'published' ? 'text-green-700' : 'text-slate-600')}>
                  Publish Now
                </span>
                <span className="text-xs text-slate-400 text-center">Visible to everyone immediately</span>
              </button>

              <button
                type="button"
                onClick={() => setValue('status', 'draft')}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition-all',
                  watchStatus === 'draft'
                    ? 'border-slate-500 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <Archive className={cn('h-5 w-5', watchStatus === 'draft' ? 'text-slate-600' : 'text-slate-400')} />
                <span className={cn('text-sm font-semibold', watchStatus === 'draft' ? 'text-slate-700' : 'text-slate-600')}>
                  Save as Draft
                </span>
                <span className="text-xs text-slate-400 text-center">Only visible to admins</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId
                ? 'Save Changes'
                : watchStatus === 'draft'
                ? 'Save as Draft'
                : 'Publish Announcement'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── View Full Announcement Modal ────────────────────────── */}
      {viewingAnnouncement && (
        <Modal
          open={!!viewingAnnouncement}
          onClose={() => setViewingAnnouncement(null)}
          title={viewingAnnouncement.title}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={cn(
                'text-xs font-semibold px-2.5 py-0.5 rounded-full',
                statusConfig[viewingAnnouncement.status ?? 'published']?.className
              )}>
                {statusConfig[viewingAnnouncement.status ?? 'published']?.label}
              </span>
              {viewingAnnouncement.is_pinned && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Pinned
                </span>
              )}
            </div>

            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {viewingAnnouncement.body}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(viewingAnnouncement.published_at), 'd MMM yyyy')}
              </span>
              {viewingAnnouncement.expires_at && (
                <span>Expires {format(new Date(viewingAnnouncement.expires_at), 'MMM d, yyyy')}</span>
              )}
            </div>

            {canManageAnnouncement(viewingAnnouncement) && (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewingAnnouncement(null);
                    openSmsModal(viewingAnnouncement);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Send SMS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewingAnnouncement(null);
                    openEdit(viewingAnnouncement);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── SMS Modal ───────────────────────────────────────────── */}
      {selectedAnnouncementForSms && (
        <SendSmsModal
          open={smsModalOpen}
          onClose={() => { setSmsModalOpen(false); setSelectedAnnouncementForSms(null); }}
          defaultMessage={`${selectedAnnouncementForSms.title}\n\n${selectedAnnouncementForSms.body}`}
          smsType="announcement"
          announcementId={selectedAnnouncementForSms.id}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] })}
        />
      )}
    </div>
  );
}
