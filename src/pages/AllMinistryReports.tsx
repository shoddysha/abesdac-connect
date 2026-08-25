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
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchAllMinistryReports, acknowledgeMinistryReport, unacknowledgeMinistryReport } from '@/services/ministryReports';
import { fetchMinistries } from '@/services/ministries';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export function AllMinistryReports() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMinistry, setSelectedMinistry] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [ackModal, setAckModal] = useState<{ reportId: string } | null>(null);
  const [ackNote, setAckNote] = useState('');

  const reportsQuery = useQuery({
    queryKey: ['all-ministry-reports'],
    queryFn: fetchAllMinistryReports,
  });

  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  useRealtimeQuery('ministry_reports', ['all-ministry-reports']);

  const reports = reportsQuery.data ?? [];
  const ministries = ministriesQuery.data ?? [];

  const acknowledgeMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      acknowledgeMinistryReport(id, profile?.id || '', note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ministry-reports'] });
      setAckModal(null);
      setAckNote('');
      toast.success('Report acknowledged');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const unacknowledgeMutation = useMutation({
    mutationFn: unacknowledgeMinistryReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ministry-reports'] });
      toast.success('Acknowledgement removed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredReports = reports.filter((report) => {
    if (selectedMinistry !== 'all' && report.ministry_id !== selectedMinistry) return false;
    if (selectedType !== 'all' && report.report_type !== selectedType) return false;
    return true;
  });

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
          <p className="text-sm text-slate-500">
            View all submitted reports from ministry leaders
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filteredReports.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

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

      {reportsQuery.isLoading ? (
        <Spinner />
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports found"
          description="No ministry reports match your filters"
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(reportsByMinistry).map(([ministryId, group]) => (
            <div key={ministryId}>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="text-lg font-semibold text-ink">{group.ministry_name}</h2>
                <Badge tone="slate">{group.reports.length} report{group.reports.length !== 1 ? 's' : ''}</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {group.reports.map((report) => (
                  <Card key={report.id}>
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

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      {!report.acknowledged_at ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAckModal({ reportId: report.id })}
                          disabled={acknowledgeMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Acknowledge
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unacknowledgeMutation.mutate(report.id)}
                          disabled={unacknowledgeMutation.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Unacknowledge
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!ackModal}
        onClose={() => {
          setAckModal(null);
          setAckNote('');
        }}
        title="Acknowledge Report"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Add an optional message to the ministry leader about this report acknowledgement.
          </p>
          <Textarea
            label="Note (Optional)"
            placeholder="e.g., Report approved. Budget allocated."
            value={ackNote}
            onChange={(e) => setAckNote(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAckModal(null);
                setAckNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (ackModal) {
                  acknowledgeMutation.mutate({
                    id: ackModal.reportId,
                    note: ackNote || undefined,
                  });
                }
              }}
              isLoading={acknowledgeMutation.isPending}
            >
              <CheckCircle className="h-4 w-4" />
              Acknowledge
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
