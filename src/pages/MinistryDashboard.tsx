import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ListTodo,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchMinistries } from '@/services/ministries';
import { fetchMembers } from '@/services/members';
import {
  fetchMinistryTasks,
  createMinistryTask,
  updateMinistryTask,
  deleteMinistryTask,
  getMinistryTaskStats,
  type CreateTaskInput,
  type MinistryTaskWithDetails,
} from '@/services/ministryTasks';
import {
  fetchMinistryReports,
  createMinistryReport,
  updateMinistryReport,
  deleteMinistryReport,
  generateReportPeriods,
  type CreateReportInput,
  type MinistryReportWithDetails,
} from '@/services/ministryReports';
import type { TaskPriority, TaskStatus, ReportType } from '@/types/database';

const taskSchema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
});
type TaskFormValues = z.infer<typeof taskSchema>;

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

export function MinistryDashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tasks' | 'reports'>('tasks');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MinistryTaskWithDetails | null>(null);
  const [editingReport, setEditingReport] = useState<MinistryReportWithDetails | null>(null);

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);

  const tasksQuery = useQuery({
    queryKey: ['ministry-tasks', userMinistry?.id],
    queryFn: () => fetchMinistryTasks(userMinistry!.id),
    enabled: !!userMinistry,
  });

  const reportsQuery = useQuery({
    queryKey: ['ministry-reports', userMinistry?.id],
    queryFn: () => fetchMinistryReports(userMinistry!.id),
    enabled: !!userMinistry,
  });

  const statsQuery = useQuery({
    queryKey: ['ministry-task-stats', userMinistry?.id],
    queryFn: () => getMinistryTaskStats(userMinistry!.id),
    enabled: !!userMinistry,
  });

  const membersQuery = useQuery({
    queryKey: ['members', { status: 'active' }],
    queryFn: () => fetchMembers({ status: 'active' }),
  });

  useRealtimeQuery('ministry_tasks', ['ministry-tasks', userMinistry?.id]);
  useRealtimeQuery('ministry_reports', ['ministry-reports', userMinistry?.id]);

  const tasks = tasksQuery.data ?? [];
  const reports = reportsQuery.data ?? [];
  const stats = statsQuery.data;

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'medium' },
  });

  const reportForm = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { report_type: 'monthly' },
  });

  const reportType = reportForm.watch('report_type');
  const reportPeriods = generateReportPeriods(reportType);

  function openTaskModal(task?: MinistryTaskWithDetails) {
    if (task) {
      setEditingTask(task);
      taskForm.reset({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        assigned_to: task.assigned_to || '',
        due_date: task.due_date || '',
      });
    } else {
      setEditingTask(null);
      taskForm.reset({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '' });
    }
    setTaskModalOpen(true);
  }

  function openReportModal(report?: MinistryReportWithDetails) {
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

  async function onTaskSubmit(values: TaskFormValues) {
    if (!userMinistry) return;

    try {
      if (editingTask) {
        await updateMinistryTask(editingTask.id, {
          title: values.title,
          description: values.description,
          priority: values.priority,
          assigned_to: values.assigned_to || undefined,
          due_date: values.due_date || undefined,
        });
        toast.success('Task updated');
      } else {
        await createMinistryTask({
          ministry_id: userMinistry.id,
          title: values.title,
          description: values.description,
          priority: values.priority,
          assigned_to: values.assigned_to || undefined,
          due_date: values.due_date || undefined,
        });
        toast.success('Task created');
      }
      queryClient.invalidateQueries({ queryKey: ['ministry-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['ministry-task-stats'] });
      setTaskModalOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onReportSubmit(values: ReportFormValues) {
    if (!userMinistry) return;

    try {
      const input: CreateReportInput | any = {
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

  async function handleTaskStatusChange(task: MinistryTaskWithDetails, newStatus: TaskStatus) {
    try {
      await updateMinistryTask(task.id, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['ministry-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['ministry-task-stats'] });
      toast.success('Task updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteTask(task: MinistryTaskWithDetails) {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    try {
      await deleteMinistryTask(task.id);
      queryClient.invalidateQueries({ queryKey: ['ministry-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['ministry-task-stats'] });
      toast.success('Task deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDeleteReport(report: MinistryReportWithDetails) {
    if (!confirm(`Delete report "${report.title}"?`)) return;
    try {
      await deleteMinistryReport(report.id);
      queryClient.invalidateQueries({ queryKey: ['ministry-reports'] });
      toast.success('Report deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const priorityColors: Record<TaskPriority, 'red' | 'amber' | 'slate'> = {
    high: 'red',
    medium: 'amber',
    low: 'slate',
  };

  const statusIcons: Record<TaskStatus, any> = {
    pending: Circle,
    in_progress: Clock,
    completed: CheckCircle2,
    cancelled: AlertCircle,
  };

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Ministry Dashboard</h1>
        <EmptyState
          icon={Users}
          title="No ministry assigned"
          description="You need to be assigned as a ministry leader to access this dashboard"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">{userMinistry.name}</h1>
        <p className="text-sm text-slate-500">Ministry Dashboard & Management</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total Tasks" value={stats.total} icon={ListTodo} />
          <StatCard label="Pending" value={stats.pending} icon={Circle} tone="accent" />
          <StatCard label="In Progress" value={stats.in_progress} icon={Clock} tone="secondary" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="primary" />
          <StatCard label="High Priority" value={stats.high_priority} icon={AlertCircle} tone="accent" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'tasks'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ListTodo className="inline h-4 w-4 mr-1" />
          Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'reports'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="inline h-4 w-4 mr-1" />
          Reports ({reports.length})
        </button>
      </div>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openTaskModal()}>
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          </div>

          {tasksQuery.isLoading ? (
            <Spinner />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="No tasks yet"
              description="Create your first ministry task to get started"
            />
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const StatusIcon = statusIcons[task.status];
                return (
                  <Card key={task.id}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() =>
                          handleTaskStatusChange(
                            task,
                            task.status === 'completed' ? 'pending' : 'completed'
                          )
                        }
                        className="mt-1"
                      >
                        <StatusIcon
                          className={`h-5 w-5 ${
                            task.status === 'completed' ? 'text-green-600' : 'text-slate-400'
                          }`}
                        />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={`font-semibold text-ink ${
                              task.status === 'completed' ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {task.title}
                          </h3>
                          <div className="flex gap-1 shrink-0">
                            <Badge tone={priorityColors[task.priority]}>{task.priority}</Badge>
                          </div>
                        </div>

                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                          {task.assigned_member_name && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {task.assigned_member_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openTaskModal(task)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openReportModal()}>
              <Plus className="h-4 w-4" /> Submit Report
            </Button>
          </div>

          {reportsQuery.isLoading ? (
            <Spinner />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Submit your first ministry report"
            />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Card key={report.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-ink">{report.title}</h3>
                        <Badge tone="blue">{report.report_type}</Badge>
                        <span className="text-xs text-slate-500">{report.report_period}</span>
                      </div>

                      {report.summary && (
                        <p className="text-sm text-slate-600 mb-2">{report.summary}</p>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {report.attendance_count !== null && (
                          <div>
                            <span className="text-slate-500">Attendance:</span>{' '}
                            <span className="font-medium">{report.attendance_count}</span>
                          </div>
                        )}
                        {report.expenses !== null && (
                          <div>
                            <span className="text-slate-500">Expenses:</span>{' '}
                            <span className="font-medium">GH₵{report.expenses.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-2">
                        Submitted: {new Date(report.submitted_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openReportModal(report)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Modal */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'New Task'}
      >
        <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
          <Input
            label="Task Title"
            {...taskForm.register('title')}
            error={taskForm.formState.errors.title?.message}
          />

          <Textarea
            label="Description"
            rows={3}
            {...taskForm.register('description')}
            error={taskForm.formState.errors.description?.message}
          />

          <Select
            label="Priority"
            options={[
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
            {...taskForm.register('priority')}
            error={taskForm.formState.errors.priority?.message}
          />

          <Select
            label="Assign To"
            options={[
              { value: '', label: 'Unassigned' },
              ...(membersQuery.data || []).map((m) => ({
                value: m.id,
                label: `${m.first_name} ${m.last_name}`,
              })),
            ]}
            {...taskForm.register('assigned_to')}
          />

          <Input
            type="date"
            label="Due Date"
            {...taskForm.register('due_date')}
            error={taskForm.formState.errors.due_date?.message}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={taskForm.formState.isSubmitting}>
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>

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
            {...reportForm.register('title')}
            error={reportForm.formState.errors.title?.message}
          />

          <Textarea
            label="Summary"
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
              {...reportForm.register('attendance_count')}
            />

            <Input
              type="number"
              step="0.01"
              label="Expenses (GH₵)"
              {...reportForm.register('expenses')}
            />
          </div>

          <Textarea
            label="Future Plans"
            placeholder="Plans for next period"
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
