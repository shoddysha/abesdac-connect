import { useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, HeartHandshake, UserPlus, X, Users, ImagePlus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import {
  fetchMinistries,
  fetchMinistryMemberCounts,
  createMinistry,
  updateMinistry,
  deleteMinistry,
  fetchMinistryMembers,
  addMemberToMinistry,
  removeMemberFromMinistry,
} from '@/services/ministries';
import { fetchProfiles } from '@/services/users';
import { fetchMembers } from '@/services/members';
import { uploadMinistryLogo } from '@/services/storage';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  leader_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function Ministries() {
  const { hasRole } = useAuth();
  const canManage = hasRole('administrator', 'secretary');
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [membersModalId, setMembersModalId] = useState<string | null>(null);

  // Logo state for the create/edit form — see the "MINISTRY LOGO" section
  // further down (inside the <Modal> for the form) for where this is used.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const ministriesQuery = useQuery({ queryKey: ['ministries'], queryFn: fetchMinistries });
  const memberCountsQuery = useQuery({ queryKey: ['ministry-member-counts'], queryFn: fetchMinistryMemberCounts });
  const profilesQuery = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles, enabled: canManage });
  useRealtimeQuery('ministries', ['ministries']);
  useRealtimeQuery('ministry_members', ['ministry-member-counts']);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function openCreate() {
    reset({ name: '', description: '', leader_id: '' });
    setEditingId(null);
    setLogoFile(null);
    setLogoPreview(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    const m = ministriesQuery.data?.find((x) => x.id === id);
    if (!m) return;
    reset({ name: m.name, description: m.description ?? '', leader_id: m.leader_id ?? '' });
    setEditingId(id);
    setLogoFile(null);
    setLogoPreview(m.logo_url);
    setFormOpen(true);
  }

  // ------------------------------------------------------------------
  // MINISTRY LOGO — this is where a logo file picked in the form gets
  // turned into a real, hosted image URL before the ministry is saved.
  // To change how/where logos are stored, edit uploadMinistryLogo() in
  // src/services/storage.ts (it currently uses the "church-assets"
  // Supabase Storage bucket).
  // ------------------------------------------------------------------
  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function onSubmit(values: FormValues) {
    try {
      let logo_url: string | null | undefined = editingId ? undefined : null; // keep existing logo on edit unless a new file was picked
      if (logoFile) {
        logo_url = await uploadMinistryLogo(logoFile, values.name);
      }

      const payload = { ...values, leader_id: values.leader_id || null, ...(logo_url !== undefined ? { logo_url } : {}) };
      if (editingId) {
        await updateMinistry(editingId, payload);
        toast.success('Ministry updated');
      } else {
        await createMinistry(payload);
        toast.success('Ministry created');
      }
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ministries'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  // ------------------------------------------------------------------

  async function handleDelete(id: string) {
    if (!confirm('Delete this ministry? Members will be unassigned, not deleted.')) return;
    await deleteMinistry(id);
    toast.success('Ministry deleted');
    queryClient.invalidateQueries({ queryKey: ['ministries'] });
  }

  const leaderOptions = (profilesQuery.data ?? []).map((p) => ({ value: p.id, label: p.full_name }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministries</h1>
          <p className="text-sm text-slate-500">Manage church ministries, leaders, and members.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New ministry
          </Button>
        )}
      </div>

      {ministriesQuery.isLoading ? (
        <Spinner />
      ) : (ministriesQuery.data ?? []).length === 0 ? (
        <EmptyState icon={HeartHandshake} title="No ministries yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ministriesQuery.data!.map((ministry) => (
            <Card key={ministry.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* MINISTRY LOGO (card view) — falls back to the generic icon when no logo_url is set */}
                  {ministry.logo_url ? (
                    <img
                      src={ministry.logo_url}
                      alt={`${ministry.name} logo`}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50">
                      <HeartHandshake className="h-5 w-5 text-accent" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-ink">{ministry.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{ministry.description || 'No description'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Leader: {ministry.profiles?.full_name ?? 'Unassigned'}</span>
                {/* MEMBER COUNT — pulled from ministry_members via fetchMinistryMemberCounts() */}
                <span className="flex items-center gap-1 font-medium text-ink">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {memberCountsQuery.data?.[ministry.id] ?? 0}
                </span>
              </div>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <Button variant="ghost" size="sm" onClick={() => setMembersModalId(ministry.id)}>
                  <UserPlus className="h-3.5 w-3.5" /> Members
                </Button>
                {canManage && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(ministry.id)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ministry.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit ministry' : 'New ministry'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* ================= MINISTRY LOGO (form) =================
              This is the field to edit if you want to change how the
              logo picker looks or behaves. handleLogoChange() above
              stores the picked file; onSubmit() uploads it and saves
              the resulting URL onto the ministry's logo_url column. */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50">
              Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
          </div>
          {/* ================= end MINISTRY LOGO ================= */}

          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Textarea label="Description" {...register('description')} />
          <Select
            label="Leader"
            placeholder="No leader assigned"
            options={[{ value: '', label: 'No leader assigned' }, ...leaderOptions]}
            {...register('leader_id')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Save changes' : 'Create ministry'}
            </Button>
          </div>
        </form>
      </Modal>

      {membersModalId && (
        <MinistryMembersModal ministryId={membersModalId} onClose={() => setMembersModalId(null)} canManage={canManage} />
      )}
    </div>
  );
}

function MinistryMembersModal({
  ministryId,
  onClose,
  canManage,
}: {
  ministryId: string;
  onClose: () => void;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [addingMemberId, setAddingMemberId] = useState('');
  const membersInMinistryQuery = useQuery({
    queryKey: ['ministry-members', ministryId],
    queryFn: () => fetchMinistryMembers(ministryId),
  });
  const allMembersQuery = useQuery({ queryKey: ['members', { status: 'active' }], queryFn: () => fetchMembers({ status: 'active' }) });

  const assignedIds = new Set((membersInMinistryQuery.data ?? []).map((r: any) => r.members?.id));
  const availableMembers = (allMembersQuery.data ?? []).filter((m) => !assignedIds.has(m.id));

  async function handleAdd() {
    if (!addingMemberId) return;
    await addMemberToMinistry(ministryId, addingMemberId);
    setAddingMemberId('');
    queryClient.invalidateQueries({ queryKey: ['ministry-members', ministryId] });
    queryClient.invalidateQueries({ queryKey: ['ministry-member-counts'] });
  }

  async function handleRemove(rowId: string) {
    await removeMemberFromMinistry(rowId);
    queryClient.invalidateQueries({ queryKey: ['ministry-members', ministryId] });
    queryClient.invalidateQueries({ queryKey: ['ministry-member-counts'] });
  }

  return (
    <Modal open onClose={onClose} title="Ministry members">
      {canManage && (
        <div className="mb-4 flex gap-2">
          <Select
            value={addingMemberId}
            onChange={(e) => setAddingMemberId(e.target.value)}
            placeholder="Select a member to add"
            options={[
              { value: '', label: 'Select a member to add' },
              ...availableMembers.map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` })),
            ]}
          />
          <Button onClick={handleAdd} disabled={!addingMemberId}>
            Add
          </Button>
        </div>
      )}
      {membersInMinistryQuery.isLoading ? (
        <Spinner />
      ) : (membersInMinistryQuery.data ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No members assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {membersInMinistryQuery.data!.map((row: any) => (
            <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-sm text-ink">
                {row.members?.first_name} {row.members?.last_name}
              </span>
              {canManage && (
                <button onClick={() => handleRemove(row.id)} className="text-slate-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
