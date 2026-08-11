import { supabase } from '@/lib/supabase';
import type { MinistryTask, TaskPriority, TaskStatus } from '@/types/database';

export interface MinistryTaskWithDetails extends MinistryTask {
  assigned_member_name?: string;
  ministry_name?: string;
}

export interface CreateTaskInput {
  ministry_id: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigned_to?: string;
  due_date?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigned_to?: string;
  due_date?: string;
}

/**
 * Fetch all tasks for a ministry
 */
export async function fetchMinistryTasks(ministryId: string): Promise<MinistryTaskWithDetails[]> {
  const { data, error } = await supabase
    .from('ministry_tasks')
    .select(`
      *,
      ministries(name),
      members(first_name, last_name)
    `)
    .eq('ministry_id', ministryId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false });

  if (error) throw error;

  return (data || []).map((task: any) => ({
    ...task,
    ministry_name: task.ministries?.name,
    assigned_member_name: task.members
      ? `${task.members.first_name} ${task.members.last_name}`
      : undefined,
  }));
}

/**
 * Create a new task
 */
export async function createMinistryTask(input: CreateTaskInput): Promise<MinistryTask> {
  const { data, error } = await supabase
    .from('ministry_tasks')
    .insert({
      ministry_id: input.ministry_id,
      title: input.title,
      description: input.description || null,
      priority: input.priority || 'medium',
      assigned_to: input.assigned_to || null,
      due_date: input.due_date || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a task
 */
export async function updateMinistryTask(id: string, updates: UpdateTaskInput): Promise<void> {
  const payload: any = { ...updates };
  
  // If marking as completed, set completed_at
  if (updates.status === 'completed' && !payload.completed_at) {
    payload.completed_at = new Date().toISOString();
  }
  
  // If reopening a completed task, clear completed_at
  if (updates.status && updates.status !== 'completed') {
    payload.completed_at = null;
  }

  const { error } = await supabase
    .from('ministry_tasks')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

/**
 * Delete a task
 */
export async function deleteMinistryTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('ministry_tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get task statistics for a ministry
 */
export async function getMinistryTaskStats(ministryId: string) {
  const { data, error } = await supabase
    .from('ministry_tasks')
    .select('status, priority')
    .eq('ministry_id', ministryId);

  if (error) throw error;

  const tasks = data || [];
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
    high_priority: tasks.filter((t) => t.priority === 'high').length,
  };
}
