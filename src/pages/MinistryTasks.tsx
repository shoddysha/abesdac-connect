import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  ListTodo,
  Calendar,
  Users,
  ArrowLeft,
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
import { supabase } from '@/lib/supabase';
import { fetchMinistries } from '@/services/ministries';
import {
  fetchMinistryTasks,
  createMinistryTask,
  updateMinistryTask,
  deleteMinistryTask,
  getMinistryTaskStats,
  type MinistryTaskWithDetails,
} from '@/services/ministryTasks';
import type { TaskPriority, TaskStatus } from '@/types/database';

const taskSchema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
});
type TaskFormValues = z.infer<typeof taskSchema>;

const statusIcons: Record<TaskStatus, any> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  cancelled: AlertCircle,
};

const priorityColors: Record<TaskPriority, 'red' | 'amber' | 'slate'> = {
  high: 'red',
  medium: 'amber',
  low: 'slate',
};

export function MinistryTasks() {
  const { profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MinistryTaskWithDetails | null>(null);

  const canEdit = hasRole('ministry_leader'); // Only ministry leaders can edit

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);

  // Fetch ministry members
  const membersQuery = useQuery({
    queryKey: ['ministry-members', userMinistry?.id],
    queryFn: async () => {
      if (!userMinistry) return [];
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('ministry_id', userMinistry.id)
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!userMinistry && canEdit,
  });

  const tasksQuery = useQuery({
    queryKey: ['ministry-tasks', userMinistry?.id],
    queryFn: () => fetchMinistryTasks(userMinistry!.id),
    enabled: !!userMinistry,
  });

  const statsQuery = useQuery({
    queryKey: ['ministry-task-stats', userMinistry?.id],
    queryFn: () => getMinistryTaskStats(userMinistry!.id),
    enabled: !!userMinistry,
  });

  useRealtimeQuery('ministry_tasks', ['ministry-tasks', userMinistry?.id]);
  useRealtimeQuery('ministry_tasks', ['ministry-task-stats', userMinistry?.id]);

  const tasks = tasksQuery.data ?? [];
  const stats = statsQuery.data;

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'medium' },
  });

  function openTaskModal(task?: MinistryTaskWithDetails) {
    if (!canEdit) return;
    
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
      taskForm.reset({
        title: '',
        description: '',
        priority: 'medium',
        assigned_to: '',
        due_date: '',
      });
    }
    setTaskModalOpen(true);
  }

  async function onTaskSubmit(values: TaskFormValues) {
    if (!userMinistry || !canEdit) return;

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

  async function handleTaskStatusChange(task: MinistryTaskWithDetails, newStatus: TaskStatus) {
    if (!canEdit) return;
    
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
    if (!canEdit) return;
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

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Ministry Tasks</h1>
        <EmptyState
          icon={ListTodo}
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
            <h1 className="text-2xl font-bold text-ink">Ministry Tasks</h1>
            <p className="text-sm text-slate-500">{userMinistry.name}</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => openTaskModal()}>
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Total" value={stats.total} icon={ListTodo} />
          <StatCard label="Pending" value={stats.pending} icon={Circle} tone="accent" />
          <StatCard label="In Progress" value={stats.in_progress} icon={Clock} tone="secondary" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="primary" />
          <StatCard label="High Priority" value={stats.high_priority} icon={AlertCircle} tone="accent" />
        </div>
      )}

      {tasksQuery.isLoading ? (
        <Spinner />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description={canEdit ? "Create your first ministry task" : "No tasks have been created yet"}
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const StatusIcon = statusIcons[task.status];
            return (
              <Card key={task.id}>
                <div className="flex items-start gap-3">
                  {canEdit ? (
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
                  ) : (
                    <StatusIcon
                      className={`h-5 w-5 mt-1 ${
                        task.status === 'completed' ? 'text-green-600' : 'text-slate-400'
                      }`}
                    />
                  )}

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

                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openTaskModal(task)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
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
    </div>
  );
}
