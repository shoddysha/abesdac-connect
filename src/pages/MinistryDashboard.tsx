import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Users,
  Calendar,
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  FileText,
  Activity,
  Target,
  Award,
  PiggyBank,
  Plus,
  Trash2,
  Send,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { supabase } from '@/lib/supabase';
import { fetchAllMinistryLeaders } from '@/services/leaders';
import {
  fetchMinistryBudgets,
  createMinistryBudget,
  submitMinistryBudget,
  deleteMinistryBudget,
  computeTotal,
} from '@/services/ministryBudgets';
import type { MinistryBudgetWithDetails } from '@/services/ministryBudgets';
import { format, formatDistanceToNow } from 'date-fns';

// ── Budget form schema ────────────────────────────────────────────────────────
const lineItemSchema = z.object({
  label: z.string().min(1, 'Item name required'),
  amount: z.coerce.number().min(0, 'Amount must be 0 or more'),
  note: z.string().optional(),
});

const budgetSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  budget_type: z.enum(['annual', 'event', 'project', 'quarterly', 'other']),
  period: z.string().min(1, 'Period is required'),
  description: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, 'Add at least one budget line item'),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

const BUDGET_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  event: 'Event',
  project: 'Project',
  quarterly: 'Quarterly',
  other: 'Other',
};

// ── Component ─────────────────────────────────────────────────────────────────
export function MinistryDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);

  // ── Ministry + members (single query) ────────────────────────────────────
  const ministryQuery = useQuery({
    queryKey: ['my-ministry-full', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from('ministries')
        .select('*, ministry_members(members(*))')
        .eq('leader_id', profile.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
    staleTime: 0,
  });

  const userMinistry = ministryQuery.data ?? null;

  const members = (userMinistry?.ministry_members ?? [])
    .map((row: any) => row.members)
    .filter((m: any) => m && m.status === 'active')
    .sort((a: any, b: any) => a.first_name.localeCompare(b.first_name));

  // ── Leadership team ───────────────────────────────────────────────────────
  const leadersQuery = useQuery({
    queryKey: ['ministry-leaders'],
    queryFn: fetchAllMinistryLeaders,
    staleTime: 0,
  });

  // ── Upcoming events ───────────────────────────────────────────────────────
  const eventsQuery = useQuery({
    queryKey: ['ministry-events'],
    queryFn: async () => {
      const today = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('start_time', today)
        .order('start_time', { ascending: true })
        .limit(5);
      if (error) throw error;
      if (!data || data.length === 0) {
        const { data: recent, error: recentError } = await supabase
          .from('events')
          .select('*')
          .order('start_time', { ascending: false })
          .limit(5);
        if (recentError) throw recentError;
        return recent || [];
      }
      return data;
    },
    staleTime: 0,
  });

  // ── Budgets for this ministry ─────────────────────────────────────────────
  const budgetsQuery = useQuery({
    queryKey: ['ministry-budgets', userMinistry?.id],
    queryFn: () => fetchMinistryBudgets(userMinistry!.id),
    enabled: !!userMinistry?.id,
    staleTime: 0,
  });

  // ── Recent activity ───────────────────────────────────────────────────────
  const activityQuery = useQuery({
    queryKey: ['ministry-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
  });

  // ── Attendance stats ──────────────────────────────────────────────────────
  const attendanceQuery = useQuery({
    queryKey: ['ministry-attendance'],
    queryFn: async () => {
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date')
        .gte('date', firstDayLastMonth.toISOString().split('T')[0]);
      if (error) throw error;
      const thisMonth = (data || []).filter((a) => new Date(a.date) >= firstDayThisMonth).length;
      const lastMonth = (data || []).filter(
        (a) => new Date(a.date) >= firstDayLastMonth && new Date(a.date) < firstDayThisMonth,
      ).length;
      return { total: data?.length || 0, thisMonth, lastMonth };
    },
    staleTime: 0,
  });

  // ── Realtime ──────────────────────────────────────────────────────────────
  useRealtimeQuery('ministries', ['my-ministry-full', profile?.id]);
  useRealtimeQuery('ministry_members', ['my-ministry-full', profile?.id]);
  useRealtimeQuery('ministry_leaders', ['ministry-leaders']);
  useRealtimeQuery('events', ['ministry-events']);
  useRealtimeQuery('ministry_budgets', ['ministry-budgets', userMinistry?.id]);
  useRealtimeQuery('audit_logs', ['ministry-activity']);

  const leaders = (leadersQuery.data ?? []).filter((l) => l.ministry_id === userMinistry?.id);
  const events = eventsQuery.data ?? [];
  const budgets = budgetsQuery.data ?? [];
  const attendance = attendanceQuery.data;

  const attendanceGrowth = attendance
    ? attendance.lastMonth > 0
      ? ((attendance.thisMonth - attendance.lastMonth) / attendance.lastMonth) * 100
      : 0
    : 0;

  const submittedBudgets = budgets.filter((b) => b.status === 'submitted');
  const totalBudgeted = budgets.reduce((s, b) => s + b.total_amount, 0);

  // ── Budget form ───────────────────────────────────────────────────────────
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      budget_type: 'annual',
      period: String(new Date().getFullYear()),
      line_items: [{ label: '', amount: 0, note: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });
  const watchedItems = watch('line_items');
  const previewTotal = computeTotal(
    (watchedItems || []).map((i) => ({ label: i.label, amount: Number(i.amount) || 0 })),
  );

  async function onBudgetSubmit(values: BudgetFormValues) {
    if (!userMinistry || !profile) return;
    try {
      await createMinistryBudget(
        {
          ministry_id: userMinistry.id,
          title: values.title,
          budget_type: values.budget_type,
          period: values.period,
          description: values.description,
          line_items: values.line_items.map((i) => ({
            label: i.label,
            amount: Number(i.amount),
            note: i.note || undefined,
          })),
        },
        profile.id,
      );
      toast.success('Budget created');
      setBudgetModalOpen(false);
      reset({
        budget_type: 'annual',
        period: String(new Date().getFullYear()),
        line_items: [{ label: '', amount: 0, note: '' }],
      });
      queryClient.invalidateQueries({ queryKey: ['ministry-budgets'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleSubmitBudget(budgetId: string) {
    try {
      await submitMinistryBudget(budgetId);
      toast.success('Budget submitted for review');
      queryClient.invalidateQueries({ queryKey: ['ministry-budgets'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteBudget(budgetId: string) {
    if (!confirm('Delete this budget?')) return;
    try {
      await deleteMinistryBudget(budgetId);
      toast.success('Budget deleted');
      queryClient.invalidateQueries({ queryKey: ['ministry-budgets'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ── Loading / empty guards ────────────────────────────────────────────────
  if (ministryQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">My Ministry</h1>
        <Spinner />
      </div>
    );
  }

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">My Ministry</h1>
        <EmptyState
          icon={Users}
          title="No ministry assigned"
          description="You need to be assigned as a ministry leader to access this page"
        />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate">{userMinistry.name}</h1>
          <p className="text-sm text-slate-500">
            {userMinistry.description || 'Ministry Overview & Management'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/leaders')}>
            <Users className="h-4 w-4" /> Leadership Team
          </Button>
          <Button onClick={() => navigate('/events?action=add')}>
            <Calendar className="h-4 w-4" /> Create Event
          </Button>
        </div>
      </div>

      {/* Stats — removed Pending Tasks, kept Members + Leaders + Attendance Growth, added Budget */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Members" value={members.length} icon={Users} tone="primary" />
        <StatCard label="Leadership Team" value={leaders.length} icon={Award} tone="secondary" />
        <StatCard
          label="Attendance Growth"
          value={`${attendanceGrowth > 0 ? '+' : ''}${attendanceGrowth.toFixed(0)}%`}
          icon={TrendingUp}
          tone={attendanceGrowth > 0 ? 'primary' : 'secondary'}
        />
        <StatCard
          label="Total Budgeted"
          value={`GH₵${totalBudgeted.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={PiggyBank}
          tone="accent"
        />
      </div>

      {/* Members + Leaders */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ministry Members */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Ministry Members"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/members?ministry_id=${userMinistry.id}`)}
              >
                View All ({members.length})
              </Button>
            }
          />
          {ministryQuery.isLoading ? (
            <Spinner />
          ) : members.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No members yet"
              description="Members will appear here when assigned to your ministry"
            />
          ) : (
            <div className="space-y-2">
              {members.slice(0, 8).map((member: any) => (
                <div
                  key={member.id}
                  onClick={() => navigate(`/members/${member.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-50 text-secondary font-semibold shrink-0">
                      {member.first_name[0]}{member.last_name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500">
                        {member.phone && (
                          <span className="flex items-center gap-1 truncate">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{member.phone}</span>
                          </span>
                        )}
                        {member.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge tone="slate">{member.member_code}</Badge>
                </div>
              ))}
              {members.length > 8 && (
                <p className="text-center text-sm text-slate-500 pt-2">
                  +{members.length - 8} more members
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Leadership Team */}
        <Card>
          <CardHeader
            title="Leadership Team"
            action={
              <Button size="sm" variant="outline" onClick={() => navigate('/leaders')}>
                Manage
              </Button>
            }
          />
          {leadersQuery.isLoading ? (
            <Spinner />
          ) : leaders.length === 0 ? (
            <EmptyState icon={Award} title="No leaders yet" description="Add deputy, secretary, and other leaders" />
          ) : (
            <div className="space-y-3">
              {leaders.map((leader) => (
                <div key={leader.id} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary text-xs font-semibold shrink-0">
                    {leader.member_name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{leader.member_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge tone="blue">{leader.leadership_role.replace('_', ' ')}</Badge>
                    </div>
                    {leader.portfolio && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        <span className="truncate">{leader.portfolio}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming Events + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming Events"
            action={
              <Button size="sm" variant="outline" onClick={() => navigate('/events?action=add')}>
                Create Event
              </Button>
            }
          />
          {eventsQuery.isLoading ? (
            <Spinner />
          ) : events.length === 0 ? (
            <EmptyState icon={Calendar} title="No events yet" description="Create your first ministry event" />
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between rounded-lg border border-slate-100 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{event.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {format(new Date(event.start_time), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  <Badge tone="blue">{event.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions — removed Manage Tasks + View Analytics */}
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate(`/members?ministry_id=${userMinistry.id}`)}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm text-center">View Members</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/ministry-reports')}
            >
              <FileText className="h-5 w-5" />
              <span className="text-sm text-center">Submit Report</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/member-followup')}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm text-center">Follow-ups</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => setBudgetModalOpen(true)}
            >
              <PiggyBank className="h-5 w-5" />
              <span className="text-sm text-center">Create Budget</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Budget Card ── */}
      <Card>
        <CardHeader
          title="Ministry Budgets"
          action={
            <Button size="sm" onClick={() => setBudgetModalOpen(true)}>
              <Plus className="h-4 w-4" /> New Budget
            </Button>
          }
        />

        {budgetsQuery.isLoading ? (
          <Spinner />
        ) : budgets.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="No budgets yet"
            description="Create a budget for the year, an upcoming event, or a project"
            action={
              <Button onClick={() => setBudgetModalOpen(true)}>
                <Plus className="h-4 w-4" /> Create Budget
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {budgets.map((budget) => {
              const isExpanded = expandedBudget === budget.id;
              return (
                <div key={budget.id} className="rounded-lg border border-slate-100 overflow-hidden">
                  {/* Budget row header */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedBudget(isExpanded ? null : budget.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">{budget.title}</p>
                      <Badge tone="slate">{BUDGET_TYPE_LABELS[budget.budget_type]}</Badge>
                      <Badge tone="blue">{budget.period}</Badge>
                      <Badge tone={budget.status === 'submitted' ? 'green' : 'amber'}>
                        {budget.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-ink">
                        GH₵{budget.total_amount.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                      {budget.description && (
                        <p className="text-sm text-slate-600">{budget.description}</p>
                      )}

                      {/* Line items table */}
                      <div className="rounded-lg overflow-hidden border border-slate-100">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Item</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Amount</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Note</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(budget.line_items || []).map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 text-ink">{item.label}</td>
                                <td className="px-3 py-2 text-right font-medium text-ink">
                                  GH₵{Number(item.amount).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-slate-500 text-xs">{item.note || '—'}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 font-bold">
                              <td className="px-3 py-2 text-ink">Total</td>
                              <td className="px-3 py-2 text-right text-ink">
                                GH₵{budget.total_amount.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                              </td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {budget.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => handleSubmitBudget(budget.id)}
                          >
                            <Send className="h-3.5 w-3.5" /> Submit for Review
                          </Button>
                        )}
                        {budget.status === 'submitted' && budget.submitted_at && (
                          <p className="text-xs text-emerald-600 font-medium self-center">
                            ✓ Submitted {format(new Date(budget.submitted_at), 'MMM d, yyyy')}
                          </p>
                        )}
                        {budget.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteBudget(budget.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader title="Recent Activity" />
        {activityQuery.isLoading ? (
          <Spinner />
        ) : activityQuery.data && activityQuery.data.length > 0 ? (
          <div className="space-y-3">
            {activityQuery.data.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                <p className="text-ink break-words">
                  <span className="font-medium">{log.user_name ?? 'System'}</span>{' '}
                  {log.description}
                  <span className="ml-2 text-xs text-slate-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Activity} title="No recent activity" description="Recent ministry activities will appear here" />
        )}
      </Card>

      {/* Ministry Vision & Goals */}
      <Card>
        <CardHeader title="Ministry Vision & Goals" />
        {userMinistry.description ? (
          <p className="text-slate-600 text-sm">{userMinistry.description}</p>
        ) : (
          <EmptyState
            icon={Target}
            title="No vision statement"
            description="Add a vision and goals for your ministry in the Ministries page"
          />
        )}
      </Card>

      {/* ── Create Budget Modal ── */}
      <Modal
        open={budgetModalOpen}
        onClose={() => {
          setBudgetModalOpen(false);
          reset({
            budget_type: 'annual',
            period: String(new Date().getFullYear()),
            line_items: [{ label: '', amount: 0, note: '' }],
          });
        }}
        title="Create Budget"
      >
        <form onSubmit={handleSubmit(onBudgetSubmit)} className="space-y-4">
          <Input
            label="Budget title"
            placeholder="e.g. Annual Budget 2026, Camp Meeting Budget"
            {...register('title')}
            error={errors.title?.message}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Type</label>
              <select
                {...register('budget_type')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50 bg-white"
              >
                <option value="annual">Annual</option>
                <option value="event">Event</option>
                <option value="project">Project</option>
                <option value="quarterly">Quarterly</option>
                <option value="other">Other</option>
              </select>
              {errors.budget_type && (
                <p className="mt-1 text-xs text-red-600">{errors.budget_type.message}</p>
              )}
            </div>
            <Input
              label="Period"
              placeholder="e.g. 2026, Q1 2026, Camp Meeting"
              {...register('period')}
              error={errors.period?.message}
            />
          </div>

          <Input
            label="Description (optional)"
            placeholder="Brief description of this budget"
            {...register('description')}
          />

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink">Budget line items</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ label: '', amount: 0, note: '' })}
              >
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            {errors.line_items?.root && (
              <p className="mb-2 text-xs text-red-600">{errors.line_items.root.message}</p>
            )}

            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <input
                      {...register(`line_items.${index}.label`)}
                      placeholder="Item name"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50"
                    />
                    {errors.line_items?.[index]?.label && (
                      <p className="mt-0.5 text-xs text-red-600">{errors.line_items[index]?.label?.message}</p>
                    )}
                  </div>
                  <div className="w-28 shrink-0">
                    <input
                      {...register(`line_items.${index}.amount`)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      {...register(`line_items.${index}.note`)}
                      placeholder="Note (optional)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary-50"
                    />
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-1 rounded-md p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Running total */}
            <div className="mt-3 flex justify-end">
              <p className="text-sm font-semibold text-ink">
                Total: GH₵{previewTotal.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBudgetModalOpen(false);
                reset({
                  budget_type: 'annual',
                  period: String(new Date().getFullYear()),
                  line_items: [{ label: '', amount: 0, note: '' }],
                });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save as Draft
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
