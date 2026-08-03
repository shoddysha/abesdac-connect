import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, MapPin, CalendarDays } from 'lucide-react';
import { format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchEvents, createEvent, updateEvent, deleteEvent } from '@/services/events';
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

  // Admin/secretary manage every event; a Ministry Leader only manages
  // events they personally created.
  function canManageEvent(event: Event) {
    return canManage || (profile?.role === 'ministry_leader' && event.created_by === profile.id);
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
      if (editingId) {
        await updateEvent(editingId, payload as any);
        toast.success('Event updated');
      } else {
        await createEvent(payload as any);
        toast.success('Event created');
      }
      setFormOpen(false);
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Events</h1>
          <p className="text-sm text-slate-500">Plan and track church events.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Create event
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink">{event.title}</h3>
                    <Badge tone={statusTone(event.status)}>{event.status}</Badge>
                  </div>
                  {event.description && <p className="mt-1 text-sm text-slate-500">{event.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>{format(new Date(event.start_time), 'EEE, MMM d, yyyy · h:mm a')}</span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {event.location}
                      </span>
                    )}
                  </div>
                </div>
                {canManageEvent(event) && (
                  <div className="flex shrink-0 gap-1">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}