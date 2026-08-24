import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Calendar,
  TrendingUp,
  Users as UsersIcon,
  DollarSign,
  Download,
  Filter,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchAllMinistryReports, acknowledgeMinistryReport, deleteMinistryReport } from '@/services/ministryReports';
import { fetchMinistries } from '@/services/ministries';
import { fetchAllMinistryBudgets, acknowledgeMinistryBudget, deleteMinistryBudget } from '@/services/ministryBudgets';
import type { MinistryBudgetWithDetails } from '@/services/ministryBudgets';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';

const BUDGET_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  event: 'Event',
  project: 'Project',
  quarterly: 'Quarterly',
  other: 'Other',
};

export function AllMinistryReports() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMinistry, setSelectedMinistry] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  // Tracks which ministry's budget panel is open (ministry_id or null)
  const [openBudgetPanel, setOpenBudgetPanel] = useState<string | null>(null);
  // Tracks which individual budget's line items are expanded
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  
  // Acknowledgement modal state
  const [ackModal, setAckModal] = useState<{ type: 'report' | 'budget'; id: string } | null>(null);
  const [ackNote, setAckNote] = useState('');

  const reportsQuery = useQuery({
    queryKey: ['all-ministry-reports'],
    queryFn: fetchAllMinistryReports,
  });

  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const budgetsQuery = useQuery({
    queryKey: ['all-ministry-budgets'],
    queryFn: fetchAllMinistryBudgets,
  });

  useRealtimeQuery('ministry_reports', ['all-ministry-reports']);
  useRealtimeQuery('ministry_budgets', ['all-ministry-budgets']);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const acknowledgeReportMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      acknowledgeMinistryReport(id, profile?.id || '', note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ministry-reports'] });
      setAckModal(null);
      setAckNote('');
    },
  });

  const acknowledgeBudgetMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      acknowledgeMinistryBudget(id, profile?.id || '', note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ministry-budgets'] });
      setAckModal(null);
      setAckNote('');
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: deleteMinistryReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ministry-reports'] });
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: deleteMinistryBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ministry-budgets'] });
    },
  });

  const reports = reportsQuery.data ?? [];
  const ministries = ministriesQuery.data ?? [];
  const allBudgets: MinistryBudgetWithDetails[] = budgetsQuery.data ?? [];

  // ── Filter reports ────────────────────────────────────────────────────────
  const filteredReports = reports.filter((report) => {
    if (selectedMinistry !== 'all' && report.ministry_id !== selectedMinistry) return false;
    if (selectedType !== 'all' && report.report_type !== selectedType) return false;
    return true;
  });

  // ── Group reports by ministry ─────────────────────────────────────────────
  const reportsByMinistry = filteredReports.reduce((acc, report) => {
    if (!acc[report.ministry_id]) {
      acc[report.ministry_id] = {
        ministry_name: report.ministry_name || 'Unknown',
        reports: [],
      };
    }
    acc[report.ministry_id].reports.push(report);
    return acc;
  }, {} as Record<string, { ministry_name: string; reports: typeof reports }>);

  // ── Group budgets by ministry ─────────────────────────────────────────────
  const budgetsByMinistry = allBudgets.reduce((acc, budget) => {
    if (!acc[budget.ministry_id]) acc[budget.ministry_id] = [];
    acc[budget.ministry_id].push(budget);
    return acc;
  }, {} as Record<string, MinistryBudgetWithDetails[]>);

  // ── CSV export ────────────────────────────────────────────────────────────
  function handleExport() {
    const headers = [
      'Ministry', 'Report Period', 'Report Type', 'Title', 'Summary',
      'Achievements', 'Challenges', 'Attendance', 'Expenses',
      'Future Plans', 'Submitted By', 'Submitted At',
    ];
    const rows = filteredReports.map((r) => [
      r.ministry_name || '',
      r.report_period,
      r.report_type,
      r.title,
      r.summary || '',
      r.achievements || '',
      r.challenges || '',
      r.attendance_count?.toString() || '',
      r.expenses?.toString() || '',
      r.future_plans || '',
      r.submitter_name || '',
      new Date(r.submitted_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ministry-reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
          <p className="text-sm text-slate-500">
            View all submitted reports and budgets from ministry leaders
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filteredReports.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              options={[
                { value: 'all', label: 'All Ministries' },
                ...ministries.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'annual', label: 'Annual' },
                { value: 'special', label: 'Special' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total Reports</p>
          <p className="text-2xl font-bold text-ink">{filteredReports.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">This Month</p>
          <p className="text-2xl font-bold text-secondary">
            {filteredReports.filter(
              (r) =>
                new Date(r.submitted_at).getMonth() === new Date().getMonth() &&
                new Date(r.submitted_at).getFullYear() === new Date().getFullYear(),
            ).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Ministries Reporting</p>
          <p className="text-2xl font-bold text-accent">{Object.keys(reportsByMinistry).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total Expenses</p>
          <p className="text-2xl font-bold text-ink">
            GH₵{filteredReports.reduce((sum, r) => sum + (r.expenses || 0), 0).toFixed(2)}
          </p>
        </Card>
      </div>

      {/* Reports + Budgets by Ministry */}
      {reportsQuery.isLoading ? (
        <Spinner />
      ) : filteredReports.length === 0 && allBudgets.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports found"
          description="No ministry reports match your filters"
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(reportsByMinistry).map(([ministryId, group]) => {
            const ministryBudgets = budgetsByMinistry[ministryId] ?? [];
            const budgetPanelOpen = openBudgetPanel === ministryId;

            return (
              <div key={ministryId}>
                {/* Ministry heading */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h2 className="text-lg font-semibold text-ink">{group.ministry_name}</h2>
                  <Badge tone="slate">{group.reports.length} report{group.reports.length !== 1 ? 's' : ''}</Badge>

                  {/* View Budgets button — only shown when ministry has submitted budgets */}
                  {ministryBudgets.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOpenBudgetPanel(budgetPanelOpen ? null : ministryId);
                        setExpandedBudget(null);
                      }}
                    >
                      <PiggyBank className="h-3.5 w-3.5" />
                      View Budgets ({ministryBudgets.length})
                      {budgetPanelOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      )}
                    </Button>
                  )}
                </div>

                {/* ── Budget panel (collapsible) ── */}
                {budgetPanelOpen && ministryBudgets.length > 0 && (
                  <div className="mb-5 rounded-xl border border-secondary/20 bg-secondary/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <PiggyBank className="h-4 w-4 text-secondary" />
                      <h3 className="text-sm font-semibold text-secondary">
                        Submitted Budgets — {group.ministry_name}
                      </h3>
                    </div>

                    {ministryBudgets.map((budget) => {
                      const isExpanded = expandedBudget === budget.id;
                      return (
                        <div key={budget.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                          {/* Acknowledgement banner */}
                          {budget.acknowledged_at && (
                            <div className="mx-4 mt-3 p-2 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-green-800">Acknowledged</p>
                                <p className="text-xs text-green-700">
                                  {format(new Date(budget.acknowledged_at), 'MMM d, yyyy')}
                                </p>
                                {budget.acknowledgement_note && (
                                  <p className="text-xs text-green-600 mt-1">{budget.acknowledgement_note}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Budget row */}
                          <div
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50"
                            onClick={() => setExpandedBudget(isExpanded ? null : budget.id)}
                          >
                            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                              <p className="text-sm font-semibold text-ink">{budget.title}</p>
                              <Badge tone="slate">{BUDGET_TYPE_LABELS[budget.budget_type]}</Badge>
                              <Badge tone="blue">{budget.period}</Badge>
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

                          {/* Budget detail */}
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

                              {budget.submitted_at && (
                                <p className="text-xs text-slate-400">
                                  Submitted {format(new Date(budget.submitted_at), 'MMM d, yyyy')}
                                  {budget.submitter_name ? ` by ${budget.submitter_name}` : ''}
                                </p>
                              )}

                              {/* Action buttons */}
                              <div className="flex items-center gap-2 pt-2">
                                {!budget.acknowledged_at ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAckModal({ type: 'budget', id: budget.id });
                                    }}
                                    disabled={acknowledgeBudgetMutation.isPending}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Acknowledge
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      acknowledgeBudgetMutation.mutate({ id: budget.id });
                                    }}
                                    disabled={acknowledgeBudgetMutation.isPending}
                                    title="Remove acknowledgement"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Unacknowledge
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this budget? This cannot be undone.')) {
                                      deleteBudgetMutation.mutate(budget.id);
                                    }
                                  }}
                                  disabled={deleteBudgetMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Report cards grid ── */}
                <div className="grid gap-4 md:grid-cols-2">
                  {group.reports.map((report) => (
                    <Card key={report.id}>
                      {/* Acknowledgement banner */}
                      {report.acknowledged_at && (
                        <div className="mb-3 p-2 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-green-800">Acknowledged</p>
                            <p className="text-xs text-green-700">
                              {format(new Date(report.acknowledged_at), 'MMM d, yyyy')}
                            </p>
                            {report.acknowledgement_note && (
                              <p className="text-xs text-green-600 mt-1">{report.acknowledgement_note}</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-ink mb-1">{report.title}</h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge tone="blue">{report.report_type}</Badge>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {report.report_period}
                            </span>
                          </div>
                        </div>
                      </div>

                      {report.summary && (
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{report.summary}</p>
                      )}

                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-slate-50 rounded-lg">
                        {report.attendance_count !== null && (
                          <div className="flex items-center gap-2">
                            <UsersIcon className="h-4 w-4 text-secondary" />
                            <div>
                              <p className="text-xs text-slate-500">Attendance</p>
                              <p className="font-semibold text-ink">{report.attendance_count}</p>
                            </div>
                          </div>
                        )}
                        {report.expenses !== null && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-accent" />
                            <div>
                              <p className="text-xs text-slate-500">Expenses</p>
                              <p className="font-semibold text-ink">GH₵{report.expenses.toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expandable details */}
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-medium text-secondary hover:text-secondary/80 mb-2">
                          View Details
                        </summary>
                        <div className="space-y-3 pl-2 border-l-2 border-slate-200">
                          {report.achievements && (
                            <div>
                              <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-green-600" /> Achievements
                              </p>
                              <p className="text-sm text-slate-600">{report.achievements}</p>
                            </div>
                          )}
                          {report.challenges && (
                            <div>
                              <p className="text-xs font-semibold text-slate-700 mb-1">Challenges</p>
                              <p className="text-sm text-slate-600">{report.challenges}</p>
                            </div>
                          )}
                          {report.future_plans && (
                            <div>
                              <p className="text-xs font-semibold text-slate-700 mb-1">Future Plans</p>
                              <p className="text-sm text-slate-600">{report.future_plans}</p>
                            </div>
                          )}
                        </div>
                      </details>

                      <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                        Submitted: {new Date(report.submitted_at).toLocaleDateString()}
                        {report.submitter_name ? ` by ${report.submitter_name}` : ''}
                      </p>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        {!report.acknowledged_at ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAckModal({ type: 'report', id: report.id })}
                            disabled={acknowledgeReportMutation.isPending}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Acknowledge
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeReportMutation.mutate({ id: report.id })}
                            disabled={acknowledgeReportMutation.isPending}
                            title="Remove acknowledgement"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Unacknowledge
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Delete this report? This cannot be undone.')) {
                              deleteReportMutation.mutate(report.id);
                            }
                          }}
                          disabled={deleteReportMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Ministries that have budgets but no visible reports (e.g. filtered out) */}
          {Object.entries(budgetsByMinistry)
            .filter(([mid]) => !reportsByMinistry[mid])
            .map(([ministryId, minisBudgets]) => {
              const ministryName = minisBudgets[0]?.ministry_name ?? 'Unknown Ministry';
              const budgetPanelOpen = openBudgetPanel === ministryId;
              return (
                <div key={`budget-only-${ministryId}`}>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h2 className="text-lg font-semibold text-ink">{ministryName}</h2>
                    <Badge tone="slate">0 reports</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOpenBudgetPanel(budgetPanelOpen ? null : ministryId);
                        setExpandedBudget(null);
                      }}
                    >
                      <PiggyBank className="h-3.5 w-3.5" />
                      View Budgets ({minisBudgets.length})
                      {budgetPanelOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-1" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      )}
                    </Button>
                  </div>

                  {budgetPanelOpen && (
                    <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <PiggyBank className="h-4 w-4 text-secondary" />
                        <h3 className="text-sm font-semibold text-secondary">
                          Submitted Budgets — {ministryName}
                        </h3>
                      </div>
                      {minisBudgets.map((budget) => {
                        const isExpanded = expandedBudget === budget.id;
                        return (
                          <div key={budget.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                            {/* Acknowledgement banner */}
                            {budget.acknowledged_at && (
                              <div className="mx-4 mt-3 p-2 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-green-800">Acknowledged</p>
                                  <p className="text-xs text-green-700">
                                    {format(new Date(budget.acknowledged_at), 'MMM d, yyyy')}
                                  </p>
                                  {budget.acknowledgement_note && (
                                    <p className="text-xs text-green-600 mt-1">{budget.acknowledgement_note}</p>
                                  )}
                                </div>
                              </div>
                            )}
                            <div
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50"
                              onClick={() => setExpandedBudget(isExpanded ? null : budget.id)}
                            >
                              <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink">{budget.title}</p>
                                <Badge tone="slate">{BUDGET_TYPE_LABELS[budget.budget_type]}</Badge>
                                <Badge tone="blue">{budget.period}</Badge>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-bold text-ink">
                                  GH₵{budget.total_amount.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                                </span>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                                {budget.description && (
                                  <p className="text-sm text-slate-600">{budget.description}</p>
                                )}
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
                                {budget.submitted_at && (
                                  <p className="text-xs text-slate-400">
                                    Submitted {format(new Date(budget.submitted_at), 'MMM d, yyyy')}
                                    {budget.submitter_name ? ` by ${budget.submitter_name}` : ''}
                                  </p>
                                )}

                                {/* Action buttons */}
                                <div className="flex items-center gap-2 pt-2">
                                  {!budget.acknowledged_at ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAckModal({ type: 'budget', id: budget.id });
                                      }}
                                      disabled={acknowledgeBudgetMutation.isPending}
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Acknowledge
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        acknowledgeBudgetMutation.mutate({ id: budget.id });
                                      }}
                                      disabled={acknowledgeBudgetMutation.isPending}
                                      title="Remove acknowledgement"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      Unacknowledge
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Delete this budget? This cannot be undone.')) {
                                        deleteBudgetMutation.mutate(budget.id);
                                      }
                                    }}
                                    disabled={deleteBudgetMutation.isPending}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Acknowledgement Modal */}
      {ackModal && (
        <Modal
          open={true}
          onClose={() => {
            setAckModal(null);
            setAckNote('');
          }}
          title={`Acknowledge ${ackModal.type === 'report' ? 'Report' : 'Budget'}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This will notify the ministry leader that their {ackModal.type} has been reviewed and acknowledged.
            </p>
            <Textarea
              label="Note (optional)"
              value={ackNote}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAckNote(e.target.value)}
              placeholder="Add a note for the ministry leader..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setAckModal(null);
                  setAckNote('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (ackModal.type === 'report') {
                    acknowledgeReportMutation.mutate({ id: ackModal.id, note: ackNote || undefined });
                  } else {
                    acknowledgeBudgetMutation.mutate({ id: ackModal.id, note: ackNote || undefined });
                  }
                }}
                disabled={acknowledgeReportMutation.isPending || acknowledgeBudgetMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                Acknowledge
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
