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

  // Handle form submit (create)
  async function onSubmit(values: FormValues) {
    try {
      let logo_url: string | null = null;
      if (logoFile) {
        logo_url = await uploadMinistryLogo(logoFile, values.name);
      }

      const payload = {
        ...values,
        leader_id: values.leader_id || null,
        logo_url,
      };

      if (editingId) {
        await updateMinistry(editingId, payload);
        toast.success('Ministry updated');
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

  const leaderOptions = (profilesQuery.data ?? []).map((p) => ({ value: p.id, label: p.full_name }));

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
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleViewDetails(ministry)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!isLeader}
                      title={isLeader ? 'View ministry dashboard' : 'Only ministry leaders can access dashboard'}
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => handleManage(ministry)}
                      className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${colors.button} disabled:opacity-50 disabled:cursor-not-allowed`}
                      disabled={!canManage && !isLeader}
                      title={canManage || isLeader ? 'Manage ministry tasks' : 'No permission to manage'}
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
