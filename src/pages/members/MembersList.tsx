import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Upload, Download, Users, Archive, RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchMembers, archiveMember, restoreMember, deleteMember } from '@/services/members';
import { fetchMinistries } from '@/services/ministries';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import { exportToCSV, exportToExcel } from '@/utils/export';
import { ImportMembersModal } from '@/features/import/ImportMembersModal';
import { MemberFormModal } from '@/pages/members/MemberFormModal';

export function MembersList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [ministryId, setMinistryId] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole('administrator', 'secretary');

  const filters = { search, status, ministryId };
  const membersQuery = useQuery({ queryKey: ['members', filters], queryFn: () => fetchMembers(filters) });
  const ministriesQuery = useQuery({ queryKey: ['ministries'], queryFn: fetchMinistries });
  useRealtimeQuery('members', ['members', filters]);

  const members = membersQuery.data ?? [];

  const ministryOptions = useMemo(
    () => (ministriesQuery.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    [ministriesQuery.data]
  );

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    if (searchParams.get('action')) {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive this member? They will be hidden from active lists but not deleted.')) return;
    await archiveMember(id);
    toast.success('Member archived');
    queryClient.invalidateQueries({ queryKey: ['members'] });
  }

  async function handleRestore(id: string) {
    await restoreMember(id);
    toast.success('Member restored');
    queryClient.invalidateQueries({ queryKey: ['members'] });
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this member? This cannot be undone.')) return;
    await deleteMember(id);
    toast.success('Member deleted');
    queryClient.invalidateQueries({ queryKey: ['members'] });
  }

  function exportRows() {
    return members.map((m) => ({
      'Member ID': m.member_code,
      'First Name': m.first_name,
      'Last Name': m.last_name,
      Gender: m.gender,
      Phone: m.phone,
      Email: m.email,
      District: m.district,
      Ministry: m.ministries?.name ?? '',
      Status: m.status,
      'Date Joined': m.date_joined,
    }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Members</h1>
          <p className="text-sm text-slate-500">{members.length} member{members.length === 1 ? '' : 's'} found</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportToCSV('members', exportRows())}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button variant="outline" onClick={() => exportToExcel('members', exportRows())}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Add member</span>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, or phone…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
            />
          </div>
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'transferred', label: 'Transferred' },
            { value: 'deceased', label: 'Deceased' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <Select
          value={ministryId}
          onChange={(e) => setMinistryId(e.target.value)}
          placeholder="All ministries"
          options={[{ value: '', label: 'All ministries' }, ...ministryOptions]}
        />
      </div>

      {membersQuery.isLoading ? (
        <Spinner />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members found"
          description="Try adjusting your filters, or add your first member."
          action={
            canManage && (
              <Button onClick={() => setFormOpen(true)}>
                <UserPlus className="h-4 w-4" /> Add member
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Ministry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/members/${member.id}`)}
                      className="flex items-center gap-3 text-left"
                    >
                      {member.profile_image_url ? (
                        <img src={member.profile_image_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary">
                          {member.first_name[0]}
                          {member.last_name[0]}
                        </div>
                      )}
                      <span className="font-medium text-ink hover:text-secondary">
                        {member.first_name} {member.last_name}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{member.member_code}</td>
                  <td className="px-4 py-3 text-slate-500">{member.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{member.ministries?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(member.status)}>{member.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <button
                          onClick={() => setEditingId(member.id)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-secondary hover:bg-secondary-50"
                        >
                          Edit
                        </button>
                      )}
                      {canManage && !member.is_archived && (
                        <button
                          onClick={() => handleArchive(member.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                      {canManage && member.is_archived && (
                        <button
                          onClick={() => handleRestore(member.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      {hasRole('administrator') && (
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ImportMembersModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['members'] })}
      />
      <MemberFormModal
        open={formOpen || !!editingId}
        memberId={editingId}
        onClose={closeForm}
        onSaved={() => {
          closeForm();
          queryClient.invalidateQueries({ queryKey: ['members'] });
        }}
      />
    </div>
  );
}
