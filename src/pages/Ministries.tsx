import { useState, useMemo, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Grid, List as ListIcon, Church, Users, Calendar, TrendingUp, Pencil, Trash2, UserPlus, X, ImagePlus, Download } from 'lucide-react';
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
import { fetchEvents } from '@/services/events';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { Ministry } from '@/types/database';

type ViewMode = 'grid' | 'list';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  leader_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Download ministry members as CSV
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

const ministryColors = [
  { border: 'border-t-blue-600', bg: 'bg-blue-50', button: 'bg-blue-600 hover:bg-blue-700' },
  { border: 'border-t-green-600', bg: 'bg-green-50', button: 'bg-green-600 hover:bg-green-700' },
  { border: 'border-t-orange-600', bg: 'bg-orange-50', button: 'bg-orange-600 hover:bg-orange-700' },
  { border: 'border-t-purple-600', bg: 'bg-purple-50', button: 'bg-purple-600 hover:bg-purple-700' },
  { border: 'border-t-pink-600', bg: 'bg-pink-50', button: 'bg-pink-600 hover:bg-pink-700' },
  { border: 'border-t-indigo-600', bg: 'bg-indigo-50', button: 'bg-indigo-600 hover:bg-indigo-700' },
];

export function Ministries() {
  const { hasRole, profile } = useAuth();
  const canManage = hasRole('administrator', 'secretary');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [membersModalId, setMembersModalId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const ministriesQuery = useQuery({ queryKey: ['ministries'], queryFn: fetchMinistries });
  const memberCountsQuery = useQuery({ queryKey: ['ministry-member-counts'], queryFn: fetchMinistryMemberCounts });
  
  const profilesQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    enabled: canManage,
  });
  
  // Fetch ministry reports count
  const reportsCountQuery = useQuery({
    queryKey: ['ministry-reports-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ministry_reports')
        .select('ministry_id, id');
      if (error) throw error;
      
      // Group by ministry_id
      const counts: Record<string, number> = {};
      data.forEach(report => {
        counts[report.ministry_id] = (counts[report.ministry_id] || 0) + 1;
      });
      return counts;
    }
  });

  // Fetch ministry tasks count
  const tasksCountQuery = useQuery({
    queryKey: ['ministry-tasks-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ministry_tasks')
        .select('ministry_id, id, status');
      if (error) throw error;
      
      // Group by ministry_id
      const counts: Record<string, { total: number; pending: number }> = {};
      data.forEach(task => {
        if (!counts[task.ministry_id]) {
          counts[task.ministry_id] = { total: 0, pending: 0 };
        }
        counts[task.ministry_id].total++;
        if (task.status === 'pending' || task.status === 'in_progress') {
          counts[task.ministry_id].pending++;
        }
      });
      return counts;
    }
  });
  
  useRealtimeQuery('ministries', ['ministries']);
  useRealtimeQuery('ministry_members', ['ministry-member-counts']);
  useRealtimeQuery('ministry_reports', ['ministry-reports-count']);
  useRealtimeQuery('ministry_tasks', ['ministry-tasks-count']);
  useRealtimeQuery('profiles', ['profiles']);

  const ministries = ministriesQuery.data ?? [];
  const memberCounts = memberCountsQuery.data ?? {};
  const reportsCounts = reportsCountQuery.data ?? {};
  const tasksCounts = tasksCountQuery.data ?? {};

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Calculate stats
  const stats = useMemo(() => {
    const active = ministries.filter(m => m.is_active).length;
    return { total: ministries.length, active };
  }, [ministries]);

  // Filter ministries by search
  const filteredMinistries = useMemo(() => {
    if (!searchQuery) return ministries;
    const query = searchQuery.toLowerCase();
    return ministries.filter(m => 
      m.name.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query) ||
      m.profiles?.full_name?.toLowerCase().includes(query)
    );
  }, [ministries, searchQuery]);

  // Get color for ministry based on index
  function getMinistryColor(index: number) {
    return ministryColors[index % ministryColors.length];
  }

  // Handle logo change
  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  // Open create modal
  function openCreate() {
    reset({ name: '', description: '', leader_id: '' });
    setEditingId(null);
    setLogoFile(null);
    setLogoPreview(null);
    setFormOpen(true);
  }

  // Open edit modal
  function openEdit(ministry: Ministry) {
    if (!canManage && profile?.id !== ministry.leader_id) {
      toast.error('You do not have permission to edit this ministry');
      return;
    }
    
    reset({
      name: ministry.name,
      description: ministry.description ?? '',
      leader_id: ministry.leader_id ?? '',
    });
    setEditingId(ministry.id);
    setLogoFile(null);
    setLogoPreview(ministry.logo_url);
    setFormOpen(true);
  }

  // Check if user can manage a specific ministry
  function canManageMinistry(ministry: Ministry) {
    return canManage || (profile?.role === 'ministry_leader' && ministry.leader_id === profile.id);
  }

  // Handle delete ministry (Admin/Secretary only)
  async function handleDelete(id: string) {
    if (!canManage) {
      toast.error('Only administrators and secretaries can delete ministries');
      return;
    }
    
    if (!confirm('Delete this ministry? Members will be unassigned, not deleted.')) return;
    
    try {
      await deleteMinistry(id);
      toast.success('Ministry deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['ministries'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Handle form submit (create/edit)
  async function onSubmit(values: FormValues) {
    try {
      let logo_url: string | null | undefined = editingId ? undefined : null;
      
      if (logoFile) {
        logo_url = await uploadMinistryLogo(logoFile, values.name);
      }

      // Ministry Leaders can edit their ministry's info, but not reassign the leader
      const payload = {
        ...values,
        ...(canManage ? { leader_id: values.leader_id || null } : {}),
        ...(logo_url !== undefined ? { logo_url } : {}),
      };

      if (editingId) {
        await updateMinistry(editingId, payload);
        toast.success('Ministry updated successfully');
      } else {
        await createMinistry(payload);
        toast.success('Ministry created successfully');
      }

      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ministries'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Handle View Details - Navigate to ministry dashboard if user is the leader
  function handleViewDetails(ministry: Ministry) {
    // Check if current user is the leader of this ministry
    if (profile?.id === ministry.leader_id) {
      navigate('/ministry-dashboard');
    } else {
      toast('Only ministry leaders can access the ministry dashboard', { icon: 'ℹ️' });
    }
  }

  // Handle Manage - Navigate to ministry tasks/reports
  function handleManage(ministry: Ministry) {
    // Check if user has permission
    if (canManage || profile?.id === ministry.leader_id) {
      navigate('/ministry-tasks');
    } else {
      toast.error('You do not have permission to manage this ministry');
    }
  }

  // Handle export members to CSV
  async function handleExport(ministry: Ministry) {
    setExportingId(ministry.id);
    try {
      const rows = await fetchMinistryMembers(ministry.id);
      if (!rows || rows.length === 0) {
        toast('No members to export yet', { icon: 'ℹ️' });
        return;
      }
      downloadMembersCsv(ministry.name, rows);
      toast.success('Members exported successfully');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingId(null);
    }
  }

  const leaderOptions = (profilesQuery.data ?? []).map((p) => ({ value: p.id, label: p.full_name }));
  const openMembersMinistry = ministries.find((m) => m.id === membersModalId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ministries</h1>
          <p className="text-sm text-slate-500 mt-1">
            {stats.total} ministry groups · {stats.active} active
          </p>
        </div>
        {canManage && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            Create Ministry
          </Button>
        )}
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search ministries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
            title="Grid view"
          >
            <Grid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
            title="List view"
          >
            <ListIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Ministry Cards */}
      {ministriesQuery.isLoading ? (
        <Spinner />
      ) : filteredMinistries.length === 0 ? (
        <EmptyState 
          icon={Church} 
          title={searchQuery ? 'No ministries found' : 'No ministries yet'}
          description={searchQuery ? 'Try adjusting your search' : 'Create your first ministry to get started'}
        />
      ) : (
        <div className={`grid gap-6 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 md:grid-cols-2' 
            : 'grid-cols-1'
        }`}>
          {filteredMinistries.map((ministry, index) => {
            const colors = getMinistryColor(index);
            const memberCount = memberCounts[ministry.id] ?? 0;
            const reportsCount = reportsCounts[ministry.id] ?? 0;
            const taskCounts = tasksCounts[ministry.id] ?? { total: 0, pending: 0 };
            const isLeader = profile?.id === ministry.leader_id;
            
            return (
              <div
                key={ministry.id}
                className={`bg-white rounded-xl border-2 border-slate-200 ${colors.border} border-t-4 overflow-hidden hover:shadow-lg transition-shadow`}
              >
                {/* Card Content */}
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Icon */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg}`}>
                        <Church className="h-6 w-6 text-slate-700" />
                      </div>
                      
                      {/* Title and Status */}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">{ministry.name}</h3>
                        <div className="flex items-center gap-2">
                          {ministry.is_active && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          )}
                          {isLeader && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              Your Ministry
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                    {ministry.description || 'No description provided'}
                  </p>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Members */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Members</p>
                        <p className="text-sm font-bold text-slate-900">{memberCount}</p>
                      </div>
                    </div>

                    {/* Reports */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Reports</p>
                        <p className="text-sm font-bold text-slate-900">{reportsCount}</p>
                      </div>
                    </div>

                    {/* Tasks */}
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg col-span-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                        <Calendar className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">Tasks</p>
                        <p className="text-sm font-bold text-slate-900">
                          {taskCounts.total} total
                          {taskCounts.pending > 0 && (
                            <span className="ml-2 text-orange-600">· {taskCounts.pending} pending</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Leader Info */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Ministry Leader</p>
                    <p className="text-sm font-medium text-slate-900">
                      {ministry.profiles?.full_name || 'Unassigned'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMembersModalId(ministry.id);
                      }}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <UserPlus className="h-4 w-4 inline mr-1" />
                      Members
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(ministry);
                      }}
                      disabled={exportingId === ministry.id}
                      className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      <Download className="h-4 w-4 inline mr-1" />
                      Export
                    </button>
                    {canManageMinistry(ministry) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ministry);
                        }}
                        className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        <Pencil className="h-4 w-4 inline mr-1" />
                        Edit
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ministry.id);
                        }}
                        className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 inline mr-1" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Ministry Modal */}
      <Modal 
        open={formOpen} 
        onClose={() => setFormOpen(false)} 
        title={editingId ? 'Edit Ministry' : 'Create Ministry'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Ministry Logo Upload */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-slate-100 border-2 border-slate-200">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
              <p className="text-xs text-slate-500 mt-2">PNG, JPG or GIF. Max size 2MB</p>
            </div>
          </div>

          <Input 
            label="Ministry Name" 
            {...register('name')} 
            error={errors.name?.message}
            placeholder="e.g., Youth Ministry"
          />
          
          <Textarea 
            label="Description" 
            {...register('description')}
            placeholder="Brief description of the ministry..."
            rows={3}
          />
          
          {canManage && (
            <Select
              label="Ministry Leader"
              placeholder="No leader assigned"
              options={[{ value: '', label: 'No leader assigned' }, ...leaderOptions]}
              {...register('leader_id')}
            />
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setFormOpen(false)} 
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              isLoading={isSubmitting} 
              className="w-full sm:w-auto"
            >
              {editingId ? 'Save Changes' : 'Create Ministry'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Ministry Members Modal */}
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

// Ministry Members Modal Component
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

  const allMembersQuery = useQuery({
    queryKey: ['members', { status: 'active' }],
    queryFn: () => fetchMembers({ status: 'active' }),
  });

  const assignedIds = new Set((membersInMinistryQuery.data ?? []).map((r: any) => r.members?.id));
  const availableMembers = (allMembersQuery.data ?? []).filter((m) => !assignedIds.has(m.id));

  async function handleAdd() {
    if (!addingMemberId) return;
    
    try {
      await addMemberToMinistry(ministryId, addingMemberId);
      setAddingMemberId('');
      queryClient.invalidateQueries({ queryKey: ['ministry-members', ministryId] });
      queryClient.invalidateQueries({ queryKey: ['ministry-member-counts'] });
      toast.success('Member added to ministry');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRemove(rowId: string) {
    try {
      await removeMemberFromMinistry(rowId);
      queryClient.invalidateQueries({ queryKey: ['ministry-members', ministryId] });
      queryClient.invalidateQueries({ queryKey: ['ministry-member-counts'] });
      toast.success('Member removed from ministry');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Modal open onClose={onClose} title="Ministry Members">
      {canManage && (
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <Select
            value={addingMemberId}
            onChange={(e) => setAddingMemberId(e.target.value)}
            placeholder="Select a member to add"
            options={[
              { value: '', label: 'Select a member to add' },
              ...availableMembers.map((m) => ({
                value: m.id,
                label: `${m.first_name} ${m.last_name}`,
              })),
            ]}
          />
          <Button onClick={handleAdd} disabled={!addingMemberId} className="sm:w-auto">
            <UserPlus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {membersInMinistryQuery.isLoading ? (
        <Spinner />
      ) : (membersInMinistryQuery.data ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No members assigned yet.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {membersInMinistryQuery.data!.map((row: any) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-900">
                  {row.members?.first_name} {row.members?.last_name}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Joined: {new Date(row.joined_at).toLocaleDateString()}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => handleRemove(row.id)}
                  className="ml-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Remove from ministry"
                >
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
