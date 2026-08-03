import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Pin, Megaphone } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/services/announcements';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import type { Announcement } from '@/types/database';

const schema = z.object({
  title: z.string().min(1, 'Required'),
  body: z.string().min(1, 'Required'),
  is_pinned: z.boolean().optional(),
  expires_at: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function Announcements() {
  const [searchParams] = useSearchParams();
  const { hasRole, profile } = useAuth();
  // Ministry Leaders can post announcements; who can edit/delete/pin a
  // *specific* one is decided per-row below via canManageAnnouncement().
  const canManage = hasRole('administrator', 'secretary');
  const canCreate = hasRole('administrator', 'secretary', 'ministry_leader');
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'add');
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['announcements'], queryFn: fetchAnnouncements });
  useRealtimeQuery('announcements', ['announcements']);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const announcements = query.data ?? [];

  // Admin/secretary manage every announcement; a Ministry Leader only
  // manages announcements they personally posted.
  function canManageAnnouncement(a: Announcement) {
    return canManage || (profile?.role === 'ministry_leader' && a.created_by === profile.id);
  }

  function openCreate() {
    reset({ title: '', body: '', is_pinned: false, expires_at: '' });
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    const a = announcements.find((x) => x.id === id);
    if (!a || !canManageAnnouncement(a)) return;
    reset({ title: a.title, body: a.body, is_pinned: a.is_pinned, expires_at: a.expires_at?.slice(0, 10) ?? '' });
    setEditingId(id);
    setFormOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        ...values,
        expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
        ...(editingId ? {} : { created_by: profile?.id }),
      };
      if (editingId) {
        await updateAnnouncement(editingId, payload as any);
        toast.success('Announcement updated');
      } else {
        await createAnnouncement(payload as any);
        toast.success('Announcement posted');
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(a: Announcement) {
    if (!canManageAnnouncement(a)) return;
    if (!confirm('Delete this announcement?')) return;
    await deleteAnnouncement(a.id);
    toast.success('Announcement deleted');
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
  }

  async function togglePin(a: Announcement) {
    if (!canManageAnnouncement(a)) return;
    await updateAnnouncement(a.id, { is_pinned: !a.is_pinned });
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Announcements</h1>
          <p className="text-sm text-slate-500">Share updates with the whole church team.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New announcement
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <Spinner />
      ) : announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {a.is_pinned && <Pin className="h-3.5 w-3.5 text-accent" />}
                    <h3 className="font-semibold text-ink">{a.title}</h3>
                    {a.is_pinned && <Badge tone="amber">Pinned</Badge>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
                  <p className="mt-3 text-xs text-slate-400">
                    Published {formatDistanceToNow(new Date(a.published_at), { addSuffix: true })}
                    {a.expires_at && ` · Expires ${format(new Date(a.expires_at), 'MMM d, yyyy')}`}
                  </p>
                </div>
                {canManageAnnouncement(a) && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => togglePin(a)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
                      title={a.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                    <button onClick={() => openEdit(a.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(a)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit announcement' : 'New announcement'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Title" {...register('title')} error={errors.title?.message} />
          <Textarea label="Message" rows={5} {...register('body')} error={errors.body?.message} />
          <Input label="Expires on (optional)" type="date" {...register('expires_at')} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" {...register('is_pinned')} className="rounded border-slate-300" />
            Pin to top
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Save changes' : 'Post announcement'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}