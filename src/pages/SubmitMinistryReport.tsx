import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowLeft, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { EmptyState, Spinner } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMinistries } from '@/services/ministries';
import { fetchEvents } from '@/services/events';
import {
  createMinistryReport,
  generateReportPeriods,
} from '@/services/ministryReports';
import { format } from 'date-fns';

const reportSchema = z.object({
  report_period: z.string().min(1, 'Required'),
  report_type: z.enum(['monthly', 'quarterly', 'annual', 'special']),
  event_id: z.string().optional(),
  title: z.string().min(1, 'Required'),
  summary: z.string().optional(),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  attendance_count: z.string().optional(),
  expenses: z.string().optional(),
  future_plans: z.string().optional(),
});
type ReportFormValues = z.infer<typeof reportSchema>;

export function SubmitMinistryReport() {
  const { profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canSubmit = hasRole('ministry_leader');

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  // Fetch events for special reports
  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);
  const events = eventsQuery.data ?? [];

  const reportForm = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { 
      report_type: 'monthly',
      event_id: '',
    },
  });

  const reportType = reportForm.watch('report_type');
  const reportPeriods = generateReportPeriods(reportType);

  async function onReportSubmit(values: ReportFormValues) {
    if (!canSubmit || !profile || !userMinistry) return;

    try {
      const input: any = {
        ministry_id: userMinistry.id,
        report_period: values.report_period,
        report_type: values.report_type,
        event_id: values.event_id || undefined,
        title: values.title,
        summary: values.summary,
        achievements: values.achievements,
        challenges: values.challenges,
        attendance_count: values.attendance_count ? parseInt(values.attendance_count) : undefined,
        expenses: values.expenses ? parseFloat(values.expenses) : undefined,
        future_plans: values.future_plans,
      };

      await createMinistryReport(input, profile.id);
      toast.success('Report submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['ministry-leader-reports'] });
      navigate('/ministry-reports');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (ministriesQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Submit Ministry Report</h1>
        <Spinner />
      </div>
    );
  }

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ministry-dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-ink">Submit Ministry Report</h1>
        </div>
        <EmptyState
          icon={FileText}
          title="No ministry assigned"
          description="Contact an administrator to assign you as a ministry leader"
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
            onClick={() => navigate('/ministry-reports')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink">Submit Ministry Report</h1>
            <p className="text-sm text-slate-500">{userMinistry.name}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/ministry-reports')}
        >
          <FileText className="h-4 w-4" />
          View My Reports
        </Button>
      </div>

      <Card>
        <form onSubmit={reportForm.handleSubmit(onReportSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Report Type"
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'annual', label: 'Annual' },
                { value: 'special', label: 'Special (Event-based)' },
              ]}
              {...reportForm.register('report_type')}
            />

            {reportType === 'special' ? (
              <Select
                label="Select Event"
                options={[
                  { value: '', label: 'Select an event' },
                  ...events.map((e: any) => ({
                    value: e.id,
                    label: `${e.title} - ${format(new Date(e.start_time), 'MMM d, yyyy')}`,
                  })),
                ]}
                {...reportForm.register('event_id')}
              />
            ) : (
              <Select
                label="Report Period"
                options={[
                  { value: '', label: 'Select period' },
                  ...reportPeriods.map((p) => ({ value: p, label: p })),
                ]}
                {...reportForm.register('report_period')}
                error={reportForm.formState.errors.report_period?.message}
              />
            )}
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
            rows={3}
            {...reportForm.register('summary')}
          />

          <Textarea
            label="Achievements"
            placeholder="What was accomplished this period?"
            rows={4}
            {...reportForm.register('achievements')}
          />

          <Textarea
            label="Challenges"
            placeholder="What challenges were faced?"
            rows={4}
            {...reportForm.register('challenges')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            rows={4}
            {...reportForm.register('future_plans')}
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/ministry-reports')}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={reportForm.formState.isSubmitting}>
              <FileText className="h-4 w-4" />
              Submit Report
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
