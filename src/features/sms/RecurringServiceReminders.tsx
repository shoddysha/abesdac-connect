import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Calendar, Clock, Edit2, Trash2, Plus, Power } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';

// Schema for recurring service reminder
const reminderSchema = z.object({
  service_type: z.enum(['sabbath_service', 'midweek_service']),
  message: z.string().min(1, 'Message is required').max(500, 'Message too long'),
  send_time: z.string().min(1, 'Time is required'),
  send_day_offset: z.number().int().min(0).max(7),
  is_active: z.boolean(),
});

type ReminderFormValues = z.infer<typeof reminderSchema>;

interface RecurringReminder {
  id: string;
  service_type: 'sabbath_service' | 'midweek_service';
  message: string;
  send_time: string;
  send_day_offset: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function fetchRecurringReminders(): Promise<RecurringReminder[]> {
  const { data, error } = await supabase
    .from('recurring_service_reminders')
    .select('*')
    .order('service_type');

  if (error) throw error;
  return data as RecurringReminder[];
}

async function createRecurringReminder(payload: Partial<RecurringReminder>): Promise<RecurringReminder> {
  const { data, error } = await supabase
    .from('recurring_service_reminders')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as RecurringReminder;
}

async function updateRecurringReminder(
  id: string,
  payload: Partial<RecurringReminder>
): Promise<RecurringReminder> {
  const { data, error } = await supabase
    .from('recurring_service_reminders')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as RecurringReminder;
}

async function deleteRecurringReminder(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_service_reminders').delete().eq('id', id);

  if (error) throw error;
}

export function RecurringServiceReminders() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['recurring-reminders'],
    queryFn: fetchRecurringReminders,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      service_type: 'sabbath_service',
      message: '',
      send_time: '18:00',
      send_day_offset: 1,
      is_active: true,
    },
  });

  function openCreate() {
    reset({
      service_type: 'sabbath_service',
      message: '',
      send_time: '18:00',
      send_day_offset: 1,
      is_active: true,
    });
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(reminder: RecurringReminder) {
    reset({
      service_type: reminder.service_type,
      message: reminder.message,
      send_time: reminder.send_time,
      send_day_offset: reminder.send_day_offset,
      is_active: reminder.is_active,
    });
    setEditingId(reminder.id);
    setFormOpen(true);
  }

  async function onSubmit(values: ReminderFormValues) {
    try {
      if (editingId) {
        await updateRecurringReminder(editingId, values);
        toast.success('Reminder updated');
      } else {
        await createRecurringReminder(values);
        toast.success('Reminder created');
      }

      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['recurring-reminders'] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleToggleActive(id: string, currentState: boolean) {
    try {
      await updateRecurringReminder(id, { is_active: !currentState });
      toast.success(currentState ? 'Reminder disabled' : 'Reminder enabled');
      queryClient.invalidateQueries({ queryKey: ['recurring-reminders'] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this recurring reminder?')) return;

    try {
      await deleteRecurringReminder(id);
      toast.success('Reminder deleted');
      queryClient.invalidateQueries({ queryKey: ['recurring-reminders'] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function getServiceLabel(type: string): string {
    return type === 'sabbath_service' ? 'Sabbath Service' : 'Midweek Prayer';
  }

  function getDayLabel(offset: number, serviceType: string): string {
    if (offset === 0) return 'On the day';
    if (offset === 1) return '1 day before';
    return `${offset} days before`;
  }

  return (
    <Card>
      <CardHeader
        title="Recurring Service Reminders"
        action={<Calendar className="h-4 w-4 text-slate-400" />}
      />
      <p className="mb-4 -mt-2 text-sm text-slate-500">
        Set up automatic SMS reminders for weekly Sabbath and midweek services
      </p>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {reminders.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No recurring reminders"
              description="Create reminders for your weekly services"
            />
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-ink">
                        {getServiceLabel(reminder.service_type)}
                      </h4>
                      <Badge tone={reminder.is_active ? 'green' : 'slate'}>
                        {reminder.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{reminder.message}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getDayLabel(reminder.send_day_offset, reminder.service_type)} at{' '}
                        {reminder.send_time}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleToggleActive(reminder.id, reminder.is_active)}
                      className={`rounded-md p-1.5 transition-colors ${
                        reminder.is_active
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                      title={reminder.is_active ? 'Disable' : 'Enable'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEdit(reminder)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button onClick={openCreate} variant="outline" className="mt-4 w-full">
            <Plus className="h-4 w-4" />
            Add Recurring Reminder
          </Button>
        </>
      )}

      {/* Form Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Recurring Reminder' : 'Add Recurring Reminder'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Service Type"
            {...register('service_type')}
            options={[
              { value: 'sabbath_service', label: 'Sabbath Service (Saturday)' },
              { value: 'midweek_service', label: 'Midweek Prayer (Wednesday)' },
            ]}
          />

          <Textarea
            label="Message"
            rows={4}
            placeholder="Reminder: Join us for Sabbath service tomorrow at 9:00 AM. See you there!"
            {...register('message')}
            error={errors.message?.message}
            hint="Keep it under 160 characters for a single SMS"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Send Timing"
              {...register('send_day_offset', { valueAsNumber: true })}
              options={[
                { value: '0', label: 'On the day' },
                { value: '1', label: '1 day before' },
                { value: '2', label: '2 days before' },
                { value: '3', label: '3 days before' },
              ]}
              hint="When to send the reminder"
            />

            <Input
              label="Time"
              type="time"
              {...register('send_time')}
              error={errors.send_time?.message}
              hint="24-hour format"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              {...register('is_active')}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Enable this reminder
          </label>

          <div className="rounded-lg bg-secondary-50 p-3 text-sm text-slate-600">
            <p className="font-medium">Example:</p>
            <p className="mt-1 text-xs">
              If you select "1 day before" at "18:00" for Sabbath Service, the SMS will be sent
              every Friday at 6:00 PM to all active members.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Save Changes' : 'Create Reminder'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
