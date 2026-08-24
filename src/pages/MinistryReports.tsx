import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Calendar,
  TrendingUp,
  Users as UsersIcon,
  DollarSign,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchMinistries } from '@/services/ministries';
import {
  fetchMinistryReports,
  createMinistryReport,
  updateMinistryReport,
  deleteMinistryReport,
  generateReportPeriods,
  type MinistryReportWithDetails,
} from '@/services/ministryReports';
import type { ReportType } from '@/types/database';
import { format } from 'date-fns';

const reportSchema = z.object({
  report_period: z.string().min(1, 'Required'),
  report_type: z.enum(['monthly', 'quarterly', 'annual', 'special']),
  title: z.string().min(1, 'Required'),
  summary: z.string().optional(),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  attendance_count: z.string().optional(),
  expenses: z.string().optional(),
  future_plans: z.string().optional(),
});
type ReportFormValues = z.infer<typeof reportSchema>;

export function MinistryReports() {
  const { profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<MinistryReportWithDetails | null>(null);

  const canEdit = hasRole('ministry_leader'); // Only ministry leaders can edit

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);

  const reportsQuery = useQuery({
    queryKey: ['ministry-reports', userMinistry?.id],
    queryFn: () => fetchMinistryReports(userMinistry!.id),
    enabled: !!userMinistry,
  });

  useRealtimeQuery('ministry_reports', ['ministry-reports', userMinistry?.id]);

  const reports = reportsQuery.data ?? [];

  const reportForm = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { report_type: 'monthly' },
  });

  const reportType = reportForm.watch('report_type');
  const reportPeriods = generateReportPeriods(reportType);

  function openReportModal(report?: MinistryReportWithDetails) {
    if (!canEdit) return;

    if (report) {
      setEditingReport(report);
      reportForm.reset({
        report_period: report.report_period,
        report_type: report.report_type,
        title: report.title,
        summary: report.summary || '',
        achievements: report.achievements || '',
        challenges: report.challenges || '',
        attendance_count: report.attendance_count?.toString() || '',
        expenses: report.expenses?.toString() || '',
        future_plans: report.future_plans || '',
      });
    } else {
      setEditingReport(null);
      reportForm.reset({
        report_period: '',
        report_type: 'monthly',
        title: '',
        summary: '',
        achievements: '',
        challenges: '',
        attendance_count: '',
        expenses: '',
        future_plans: '',
      });
    }
    setReportModalOpen(true);
  }

  async function onReportSubmit(values: ReportFormValues) {
    if (!userMinistry || !canEdit) return;

    try {
      const input: any = {
        ministry_id: userMinistry.id,
        report_period: values.report_period,
        report_type: values.report_type,
        title: values.title,
        summary: values.summary,
        achievements: values.achievements,
        challenges: values.challenges,
        attendance_count: values.attendance_count ? parseInt(values.attendance_count) : undefined,
        expenses: values.expenses ? parseFloat(values.expenses) : undefined,
        future_plans: values.future_plans,
      };

      if (editingReport) {
        await updateMinistryReport(editingReport.id, input);
        toast.success('Report updated');
      } else {
        await createMinistryReport(input);
        toast.success('Report submitted');
      }
      queryClient.invalidateQueries({ queryKey: ['ministry-reports'] });
      setReportModalOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteReport(report: MinistryReportWithDetails) {
    if (!canEdit) return;
    if (!confirm(`Delete report "${report.title}"?`)) return;

    try {
      await deleteMinistryReport(report.id);
      queryClient.invalidateQueries({ queryKey: ['ministry-reports'] });
      toast.success('Report deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
        <EmptyState
          icon={FileText}
          title="No ministry assigned"
          description="You need to be assigned as a ministry leader to access this page"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ministry-dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
            <p className="text-sm text-slate-500">{userMinistry.name}</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => openReportModal()}>
            <Plus className="h-4 w-4" /> Submit Report
          </Button>
        )}
      </div>

      {reportsQuery.isLoading ? (
        <Spinner />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description={canEdit ? "Submit your first ministry report" : "No reports have been submitted yet"}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report) => (
            <Card key={report.id}>
              {/* Acknowledgement banner */}
              {report.acknowledged_at && (
                <div className="mb-3 p-2 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-800">Acknowledged by Church Leadership</p>
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
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-ink">{report.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge tone="blue">{report.report_type}</Badge>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {report.report_period}
                    </span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openReportModal(report)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
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

              {/* Expandable Sections */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-secondary hover:text-secondary/80 mb-2">
                  View Details
                </summary>
                <div className="space-y-3 pl-2 border-l-2 border-slate-200">
                  {report.achievements && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        Achievements
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
                Submitted: {new Date(report.submitted_at).toLocaleDateString()} by{' '}
                {report.submitter_name || 'Unknown'}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Report Modal */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title={editingReport ? 'Edit Report' : 'Submit Report'}
        size="lg"
      >
        <form onSubmit={reportForm.handleSubmit(onReportSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Report Type"
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'annual', label: 'Annual' },
                { value: 'special', label: 'Special' },
              ]}
              {...reportForm.register('report_type')}
            />

            <Select
              label="Report Period"
              options={[
                { value: '', label: 'Select period' },
                ...reportPeriods.map((p) => ({ value: p, label: p })),
              ]}
              {...reportForm.register('report_period')}
              error={reportForm.formState.errors.report_period?.message}
            />
          </div>

          <Input
            label="Report Title"
            placeholder="e.g., January 2025 Ministry Report"
            {...reportForm.register('title')}
            error={reportForm.formState.errors.title?.message}
          />

          <Textarea
            label="Summary"
            placeholder="Brief overview of the reporting period"
            rows={2}
            {...reportForm.register('summary')}
          />

          <Textarea
            label="Achievements"
            placeholder="What was accomplished this period?"
            rows={3}
            {...reportForm.register('achievements')}
          />

          <Textarea
            label="Challenges"
            placeholder="What challenges were faced?"
            rows={3}
            {...reportForm.register('challenges')}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              label="Attendance Count"
              placeholder="Total attendance"
              {...reportForm.register('attendance_count')}
            />

            <Input
              type="number"
              step="0.01"
              label="Expenses (GH₵)"
              placeholder="0.00"
              {...reportForm.register('expenses')}
            />
          </div>

          <Textarea
            label="Future Plans"
            placeholder="Plans and goals for next period"
            rows={3}
            {...reportForm.register('future_plans')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setReportModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={reportForm.formState.isSubmitting}>
              {editingReport ? 'Save Changes' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
