import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Heart,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Download,
  Users,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { supabase } from '@/lib/supabase';
import { fetchMinistries } from '@/services/ministries';
import { format } from 'date-fns';

const TYPE_LABELS: Record<string, string> = {
  pastoral_care: 'Pastoral Care',
  new_member: 'New Member',
  inactive: 'Inactive Member',
  sick_visit: 'Sick Visit',
  prayer_request: 'Prayer Request',
  other: 'Other',
};

const PRIORITY_TONE: Record<string, 'red' | 'amber' | 'blue'> = {
  high: 'red',
  medium: 'amber',
  low: 'blue',
};

export function AllMemberFollowUps() {
  const queryClient = useQueryClient();
  const [selectedMinistry, setSelectedMinistry] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [search, setSearch] = useState('');

  // Fetch all follow-ups across every ministry
  const followUpsQuery = useQuery({
    queryKey: ['all-member-followups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_followups')
        .select(`
          *,
          members (first_name, last_name, member_code, phone, email),
          ministries (id, name)
        `)
        .order('follow_up_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
  });

  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  useRealtimeQuery('member_followups', ['all-member-followups']);

  const allFollowUps = followUpsQuery.data ?? [];
  const ministries = ministriesQuery.data ?? [];

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = allFollowUps.filter((fu: any) => {
    if (selectedMinistry !== 'all' && fu.ministry_id !== selectedMinistry) return false;
    if (selectedStatus === 'pending' && fu.completed_at) return false;
    if (selectedStatus === 'completed' && !fu.completed_at) return false;
    if (selectedType !== 'all' && fu.follow_up_type !== selectedType) return false;
    const name = `${fu.members?.first_name ?? ''} ${fu.members?.last_name ?? ''}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalCount = allFollowUps.length;
  const pendingCount = allFollowUps.filter((fu: any) => !fu.completed_at).length;
  const completedCount = allFollowUps.filter((fu: any) => fu.completed_at).length;
  const highPriorityCount = allFollowUps.filter(
    (fu: any) => !fu.completed_at && fu.priority === 'high'
  ).length;

  // ── Group filtered results by ministry ────────────────────────────────────
  const grouped = filtered.reduce((acc: Record<string, { name: string; items: any[] }>, fu: any) => {
    const mid = fu.ministry_id;
    if (!acc[mid]) {
      acc[mid] = {
        name: fu.ministries?.name ?? 'Unknown Ministry',
        items: [],
      };
    }
    acc[mid].items.push(fu);
    return acc;
  }, {});

  // ── Toggle completion (admin/secretary can mark too) ──────────────────────
  async function toggleComplete(id: string, isCompleted: boolean) {
    try {
      const { error } = await supabase
        .from('member_followups')
        .update({ completed_at: isCompleted ? null : new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(isCompleted ? 'Marked as pending' : 'Marked as followed up');
      queryClient.invalidateQueries({ queryKey: ['all-member-followups'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────
  function handleExport() {
    const headers = [
      'Ministry',
      'Member',
      'Member Code',
      'Type',
      'Priority',
      'Description',
      'Follow-up Date',
      'Status',
      'Completed At',
      'Phone',
      'Email',
    ];
    const rows = filtered.map((fu: any) => [
      fu.ministries?.name ?? '',
      `${fu.members?.first_name ?? ''} ${fu.members?.last_name ?? ''}`.trim(),
      fu.members?.member_code ?? '',
      TYPE_LABELS[fu.follow_up_type] ?? fu.follow_up_type,
      fu.priority,
      fu.description,
      fu.follow_up_date,
      fu.completed_at ? 'Completed' : 'Pending',
      fu.completed_at ? format(new Date(fu.completed_at), 'MMM d, yyyy') : '',
      fu.members?.phone ?? '',
      fu.members?.email ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `member-followups-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Member Follow-ups</h1>
          <p className="text-sm text-slate-500">
            Overview of all follow-up tasks across every ministry
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-2xl font-bold text-ink">{totalCount}</p>
            </div>
            <Heart className="h-8 w-8 text-red-200" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-200" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">High Priority</p>
              <p className="text-2xl font-bold text-red-600">{highPriorityCount}</p>
            </div>
            <Filter className="h-8 w-8 text-red-200" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-200" />
          </div>
        </Card>
      </div>

      {/* ── Filters ── */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by member name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              options={[
                { value: 'all', label: 'All Ministries' },
                ...ministries.map((m: any) => ({ value: m.id, label: m.name })),
              ]}
            />
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'pastoral_care', label: 'Pastoral Care' },
                { value: 'new_member', label: 'New Member' },
                { value: 'inactive', label: 'Inactive Member' },
                { value: 'sick_visit', label: 'Sick Visit' },
                { value: 'prayer_request', label: 'Prayer Request' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* ── Content ── */}
      {followUpsQuery.isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No follow-ups found"
          description={
            search || selectedMinistry !== 'all' || selectedStatus !== 'all' || selectedType !== 'all'
              ? 'No follow-ups match your filters'
              : 'Ministry leaders have not added any follow-ups yet'
          }
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([ministryId, group]) => (
            <div key={ministryId}>
              {/* Ministry group header */}
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-ink">
                <Users className="h-5 w-5 text-secondary" />
                {group.name}
                <Badge tone="slate">{group.items.length} follow-up{group.items.length !== 1 ? 's' : ''}</Badge>
                <Badge tone="amber">
                  {group.items.filter((fu) => !fu.completed_at).length} pending
                </Badge>
              </h2>

              <div className="space-y-3">
                {group.items.map((followUp: any) => {
                  const isCompleted = !!followUp.completed_at;
                  return (
                    <Card
                      key={followUp.id}
                      className={`transition-colors ${isCompleted ? 'opacity-75' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
                        {/* ── Left: details ── */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-semibold text-ink truncate">
                              {followUp.members?.first_name} {followUp.members?.last_name}
                            </h3>
                            {followUp.members?.member_code && (
                              <span className="text-xs text-slate-400 font-mono">
                                {followUp.members.member_code}
                              </span>
                            )}
                            <Badge tone={PRIORITY_TONE[followUp.priority] ?? 'slate'}>
                              {followUp.priority}
                            </Badge>
                            <Badge tone={isCompleted ? 'green' : 'slate'}>
                              {TYPE_LABELS[followUp.follow_up_type] ?? followUp.follow_up_type}
                            </Badge>
                          </div>

                          <p className="text-sm text-slate-600 break-words mb-3">
                            {followUp.description}
                          </p>

                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {format(new Date(followUp.follow_up_date), 'MMM d, yyyy')}
                            </span>
                            {followUp.members?.phone && (
                              <a
                                href={`tel:${followUp.members.phone}`}
                                className="flex items-center gap-1 hover:text-secondary"
                              >
                                <Phone className="h-3 w-3 shrink-0" />
                                {followUp.members.phone}
                              </a>
                            )}
                            {followUp.members?.email && (
                              <a
                                href={`mailto:${followUp.members.email}`}
                                className="flex items-center gap-1 hover:text-secondary min-w-0"
                              >
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{followUp.members.email}</span>
                              </a>
                            )}
                          </div>

                          {isCompleted && (
                            <p className="mt-2 text-xs font-medium text-emerald-600">
                              ✓ Followed up on{' '}
                              {format(new Date(followUp.completed_at), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>

                        {/* ── Right: toggle checkbox ── */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">
                            {isCompleted ? 'Followed up' : 'Mark done'}
                          </span>
                          <button
                            onClick={() => toggleComplete(followUp.id, isCompleted)}
                            className={`rounded-md p-2 transition-colors ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                            }`}
                            title={isCompleted ? 'Unmark — set back to pending' : 'Mark as followed up'}
                          >
                            <CheckCircle2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
