import { useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, HeartHandshake, UserPlus, X, Users, ImagePlus, Download } from 'lucide-react';
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
import type { Ministry } from '@/types/database';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  leader_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Turns a ministry's member list into a downloadable CSV file.
function downloadMembersCsv(ministryName: string, rows: any[]) {
  const headers = ['Member Code', 'First Name', 'Last Name', 'Joined Ministry On'];
  const lines = [
    headers.join(','),
    ...rows.map((row) => {
      const m = row.members;
      const cells = [
        m?.member_code ?? '',
        m?.first_name ?? '',
        m?.last_name ?? '',
        row.joined_at ? new Date(row.joined_at).toLocaleDateString() : '',
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    }),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = ministryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `${safeName}-members-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Ministries() {
  const { profile, hasRole } = useAuth();
  const canManage = hasRole('administrator', 'secretary');
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [membersModalId, setMembersModalId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Logo state for the create/edit form — see the "MINISTRY LOGO" section
  // further down (inside the <Modal> for the form) for where this is used.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const ministriesQuery = useQuery({ queryKey: ['ministries'], queryFn: fetchMinistries });
  const memberCountsQuery = useQuery({ queryKey: ['ministry-member-counts'], queryFn: fetchMinistryMemberCounts });
  // Also needed by Ministry Leaders now (their Members modal add/remove
  // controls need this), not just admin/secretary — the Leader dropdown
  // inside the edit form is still locked to admin/secretary separately.
  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    enabled: canManage || profile?.role === 'ministry_leader',
  });
  useRealtimeQuery('ministries', ['ministries']);
  useRealtimeQuery('ministry_members', ['ministry-member-counts']);
  useRealtimeQuery('profiles', ['ministries']); // When a profile (leader) changes, also invalidate ministries

  // A Ministry Leader manages exactly the one ministry they lead —
  // identified by ministries.leader_id pointing at their own profile.
  // Administrators/secretaries manage every ministry.
  function canManageMinistry(ministry: Ministry) {
    return canManage || (profile?.role === 'ministry_leader' && ministry.leader_id === profile.id);
  }

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
    if (!m || !canManageMinistry(m)) return;
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

      // Ministry Leaders can edit their ministry's info, but reassigning
      // who leads it is an org-level decision reserved for admin/secretary
      // — the Leader field is disabled for them in the form below, and we
      // additionally strip it out here as defense in depth.
      const payload = {
        ...values,
        ...(canManage ? { leader_id: values.leader_id || null } : {}),
        ...(logo_url !== undefined ? { logo_url } : {}),
      };
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
    if (!canManage) return; // deleting a ministry stays admin/secretary-only
    if (!confirm('Delete this ministry? Members will be unassigned, not deleted.')) return;
    await deleteMinistry(id);
    toast.success('Ministry deleted');
    queryClient.invalidateQueries({ queryKey: ['ministries'] });
  }

  async function handleExport(ministry: Ministry) {
    setExportingId(ministry.id);
    try {
      const rows = await fetchMinistryMembers(ministry.id);
      if (!rows || rows.length === 0) {
        toast('No members to export yet', { icon: 'ℹ️' });
        return;
      }
      downloadMembersCsv(ministry.name, rows);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingId(null);
    }
  }

  const leaderOptions = (profilesQuery.data ?? []).map((p) => ({ value: p.id, label: p.full_name }));
  const openMembersMinistry = ministriesQuery.data?.find((m) => m.id === membersModalId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministries/Departments</h1>
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
          {ministriesQuery.data!.map((ministry) => {
            const canManageThis = canManageMinistry(ministry);
            return (
              <Card key={ministry.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink truncate">{ministry.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{ministry.description || 'No description'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate">Leader: {ministry.profiles?.full_name ?? 'Unassigned'}</span>
                  {/* MEMBER COUNT — pulled from ministry_members via fetchMinistryMemberCounts() */}
                  <span className="flex items-center gap-1 font-medium text-ink whitespace-nowrap">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {memberCountsQuery.data?.[ministry.id] ?? 0}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button variant="ghost" size="sm" onClick={() => setMembersModalId(ministry.id)}>
                    <UserPlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Members</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExport(ministry)}
                    isLoading={exportingId === ministry.id}
                  >
                    <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span>
                  </Button>
                  {canManageThis && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(ministry.id)}>
                      <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit</span>
                    </Button>
                  )}
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(ministry.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Delete</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
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
            disabled={!canManage}
            hint={!canManage ? 'Only administrators and secretaries can reassign a ministry leader.' : undefined}
            options={[{ value: '', label: 'No leader assigned' }, ...leaderOptions]}
            {...register('leader_id')}
          />
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
              {editingId ? 'Save changes' : 'Create ministry'}
            </Button>
          </div>
        </form>
      </Modal>

      {membersModalId && openMembersMinistry && (
        <MinistryMembersModal
          ministryId={membersModalId}
          onClose={() => setMembersModalId(null)}
          canManage={canManageMinistry(openMembersMinistry)}
        />
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
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <Select
            value={addingMemberId}
            onChange={(e) => setAddingMemberId(e.target.value)}
            placeholder="Select a member to add"
            options={[
              { value: '', label: 'Select a member to add' },
              ...availableMembers.map((m) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` })),
            ]}
          />
          <Button onClick={handleAdd} disabled={!addingMemberId} className="sm:w-auto">
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
              <span className="text-sm text-ink truncate flex-1 mr-2">
                {row.members?.first_name} {row.members?.last_name}
              </span>
              {canManage && (
                <button onClick={() => handleRemove(row.id)} className="text-slate-400 hover:text-red-600 shrink-0">
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