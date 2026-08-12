import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, MapPin, CalendarDays, MessageSquare, Clock } from 'lucide-react';
import { format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, subHours } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchEvents, createEvent, updateEvent, deleteEvent } from '@/services/events';
import { scheduleEventReminder } from '@/services/sms';
import { SendSmsModal } from '@/features/sms/SendSmsModal';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import type { Event } from '@/types/database';

const schema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  location: z.string().optional(),
  start_time: z.string().min(1, 'Required'),
  end_time: z.string().optional(),
  status: z.enum(['upcoming', 'ongoing', 'completed', 'cancelled']),
});
type FormValues = z.infer<typeof schema>;

export function Events() {
  const [searchParams] = useSearchParams();
  const { hasRole, profile } = useAuth();
  // Ministry Leaders can create events; who can edit/delete a *specific*
  // event is decided per-row below via canManageEvent().
  const canManage = hasRole('administrator', 'secretary');
  const canCreate = hasRole('administrator', 'secretary', 'ministry_leader');
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [selectedEventForSms, setSelectedEventForSms] = useState<Event | null>(null);
  const [scheduleReminder, setScheduleReminder] = useState(false);

  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents });
  useRealtimeQuery('events', ['events']);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { status: 'upcoming' } });

  const events = eventsQuery.data ?? [];
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const eventsByDay = (day: Date) => events.filter((e) => isSameDay(new Date(e.start_time), day));

  // Admin/secretary manage every event; a Ministry Leader can manage:
  // 1. Events they personally created
  // 2. Events created by other ministry leaders
  function canManageEvent(event: Event) {
    if (canManage) return true; // Admin/secretary can manage all
    
    // Ministry leader can edit if created by any ministry leader
    if (profile?.role === 'ministry_leader') {
      return event.created_by === profile.id || event.created_by_role === 'ministry_leader';
    }
    
    return false;
  }

  const visibleEvents = useMemo(() => {
    if (selectedDay) return events.filter((e) => isSameDay(new Date(e.start_time), selectedDay));
    return events.filter((e) => isSameMonth(new Date(e.start_time), month));
  }, [events, selectedDay, month]);

  function openCreate() {
    reset({ title: '', description: '', location: '', start_time: '', end_time: '', status: 'upcoming' });
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e || !canManageEvent(e)) return;
    reset({
      title: e.title,
      description: e.description ?? '',
      location: e.location ?? '',
      start_time: e.start_time.slice(0, 16),
      end_time: e.end_time?.slice(0, 16) ?? '',
      status: e.status,
    });
    setEditingId(id);
    setFormOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        ...values,
        start_time: new Date(values.start_time).toISOString(),
        end_time: values.end_time ? new Date(values.end_time).toISOString() : null,
        ...(editingId ? {} : { created_by: profile?.id }),
      };
      
      let eventId = editingId;
      
      if (editingId) {
        await updateEvent(editingId, payload as any);
        toast.success('Event updated');
      } else {
        const newEvent = await createEvent(payload as any);
        eventId = newEvent.id;
        toast.success('Event created');
      }
      
      // Schedule 24-hour reminder if checkbox is checked
      if (scheduleReminder && eventId) {
        try {
          const eventStartTime = new Date(values.start_time);
          const reminderTime = subHours(eventStartTime, 24);
          
          // Only schedule if reminder time is in the future
          if (reminderTime > new Date()) {
            const reminderMessage = `Reminder: ${values.title} is tomorrow at ${format(eventStartTime, 'h:mm a')}${values.location ? ` at ${values.location}` : ''}. See you there!`;
            
            await scheduleEventReminder(eventId, reminderMessage, reminderTime, { all_members: true });
            toast.success('SMS reminder scheduled for 24 hours before the event');
          }
        } catch (err) {
          toast.error('Failed to schedule SMS reminder');
        }
      }
      
      setFormOpen(false);
      setScheduleReminder(false);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(event: Event) {
    if (!canManageEvent(event)) return;
    if (!confirm('Delete this event?')) return;
    await deleteEvent(event.id);
    toast.success('Event deleted');
    queryClient.invalidateQueries({ queryKey: ['events'] });
  }

  function openSmsModal(event: Event) {
    setSelectedEventForSms(event);
    const defaultMessage = `${event.title} - ${format(new Date(event.start_time), 'EEE, MMM d, yyyy at h:mm a')}${event.location ? ` at ${event.location}` : ''}. ${event.description || ''}`;
    setSmsModalOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Events</h1>
          <p className="text-sm text-slate-500">Plan and track church events.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create event</span>
          </Button>
        )}
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setMonth(subMonths(month, 1))} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
            ‹
          </button>
          <h3 className="font-semibold text-ink">{format(month, 'MMMM yyyy')}</h3>
          <button onClick={() => setMonth(addMonths(month, 1))} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100">
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOfMonth(month).getDay() }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {daysInMonth.map((day) => {
            const dayEvents = eventsByDay(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  'flex h-16 flex-col items-center justify-start rounded-lg border p-1 text-xs hover:border-secondary',
                  isSelected ? 'border-secondary bg-secondary-50' : 'border-slate-100'
                )}
              >
                <span className={cn('font-medium', isSameDay(day, new Date()) && 'text-secondary')}>{format(day, 'd')}</span>
                {dayEvents.length > 0 && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </Card>

      {eventsQuery.isLoading ? (
        <Spinner />
      ) : visibleEvents.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No events" description={selectedDay ? 'Nothing scheduled on this day.' : 'Nothing scheduled this month.'} />
      ) : (
        <div className="space-y-3">
          {visibleEvents.map((event) => (
            <Card key={event.id}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink truncate">{event.title}</h3>
                    <Badge tone={statusTone(event.status)}>{event.status}</Badge>
                  </div>
                  {event.description && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{event.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 sm:gap-4 text-xs text-slate-500">
                    <span className="whitespace-nowrap">{format(new Date(event.start_time), 'EEE, MMM d, yyyy · h:mm a')}</span>
                    {event.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{event.location}</span>
                      </span>
                    )}
                  </div>
                </div>
                {canManageEvent(event) && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openSmsModal(event)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-secondary-50 hover:text-secondary"
                      title="Send SMS"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button onClick={() => openEdit(event.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(event)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit event' : 'Create event'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Title" {...register('title')} error={errors.title?.message} />
          <Textarea label="Description" {...register('description')} />
          <Input label="Location" {...register('location')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Start" type="datetime-local" {...register('start_time')} error={errors.start_time?.message} />
            <Input label="End (optional)" type="datetime-local" {...register('end_time')} />
          </div>
          <Select
            label="Status"
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'ongoing', label: 'Ongoing' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            {...register('status')}
          />
          
          {/* Schedule SMS Reminder Checkbox */}
          {!editingId && (
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                checked={scheduleReminder}
                onChange={(e) => setScheduleReminder(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Clock className="h-4 w-4 text-secondary" />
                  Schedule SMS reminder
                </div>
                <p className="text-xs text-slate-500">Send automatic reminder to all members 24 hours before event</p>
              </div>
            </label>
          )}
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
              {editingId ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* SMS Modal */}
      {selectedEventForSms && (
        <SendSmsModal
          open={smsModalOpen}
          onClose={() => {
            setSmsModalOpen(false);
            setSelectedEventForSms(null);
          }}
          defaultMessage={`${selectedEventForSms.title} - ${format(new Date(selectedEventForSms.start_time), 'EEE, MMM d, yyyy at h:mm a')}${selectedEventForSms.location ? ` at ${selectedEventForSms.location}` : ''}. ${selectedEventForSms.description || ''}`}
          smsType="event_notification"
          eventId={selectedEventForSms.id}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
        />
      )}
    </div>
  );
}