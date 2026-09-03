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

  // Pagination
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(members.length / ITEMS_PER_PAGE);
  const paginatedMembers = members.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Helper functions
  function getInitials(firstName: string, lastName: string) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  function getAvatarColor(index: number) {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
    ];
    return colors[index % colors.length];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500 mt-1">{members.length} member{members.length === 1 ? '' : 's'} found</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportToCSV('members', exportRows())}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => exportToExcel('members', exportRows())}>
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add member
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
        <>
          {/* Member Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedMembers.map((member, index) => (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/members/${member.id}`)}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  {member.profile_image_url ? (
                    <img 
                      src={member.profile_image_url} 
                      alt={`${member.first_name} ${member.last_name}`} 
                      className="h-14 w-14 rounded-full object-cover shrink-0" 
                    />
                  ) : (
                    <div className={`h-14 w-14 rounded-full ${getAvatarColor(index)} flex items-center justify-center text-white font-semibold text-lg shrink-0`}>
                      {getInitials(member.first_name, member.last_name)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {member.first_name} {member.last_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">ID: {member.member_code}</p>
                    
                    {/* Status Badge */}
                    <div className="mt-2">
                      <Badge tone={statusTone(member.status)} className="text-xs">
                        {member.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Phone</span>
                    <span className="text-slate-900 font-medium">{member.phone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ministry</span>
                    <span className="text-slate-900 font-medium truncate ml-2">
                      {member.ministries?.name ?? '—'}
                    </span>
                  </div>
                  {member.district && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">District</span>
                      <span className="text-slate-900 font-medium">{member.district}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                    {member.status === 'archived' ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(member.id);
                          }}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3 inline mr-1" />
                          Restore
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(member.id);
                          }}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-3 w-3 inline mr-1" />
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchive(member.id);
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        <Archive className="h-3 w-3 inline mr-1" />
                        Archive
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
              <div className="flex flex-1 justify-between sm:hidden">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-700">
                    Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, members.length)}</span> of{' '}
                    <span className="font-medium">{members.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                          currentPage === page
                            ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                            : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      ›
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
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
