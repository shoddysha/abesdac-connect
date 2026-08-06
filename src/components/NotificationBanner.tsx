import { useState, useEffect } from 'react';
import { X, Bell, Calendar, Users, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchUpcomingBirthdays } from '@/services/birthdays';
import { fetchEvents } from '@/services/events';
import { isFuture, isToday, isTomorrow, format } from 'date-fns';

interface Notification {
  id: string;
  type: 'birthday' | 'event' | 'system';
  title: string;
  message: string;
  link?: string;
  icon: typeof Bell;
}

export function NotificationBanner() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dismissed_notifications');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const birthdaysQuery = useQuery({ 
    queryKey: ['upcoming-birthdays'], 
    queryFn: fetchUpcomingBirthdays 
  });
  
  const eventsQuery = useQuery({ 
    queryKey: ['events'], 
    queryFn: fetchEvents 
  });

  useEffect(() => {
    const newNotifications: Notification[] = [];

    // Check birthday notification setting
    const birthdaySmsEnabled = localStorage.getItem('notif_birthday_sms') !== 'false';
    if (birthdaySmsEnabled && birthdaysQuery.data) {
      const todaysBirthdays = birthdaysQuery.data.filter(m => m.is_today);
      if (todaysBirthdays.length > 0) {
        const names = todaysBirthdays.map(m => m.first_name).join(', ');
        newNotifications.push({
          id: `birthday-${format(new Date(), 'yyyy-MM-dd')}`,
          type: 'birthday',
          title: '🎂 Birthdays Today!',
          message: `${todaysBirthdays.length} member(s) celebrating: ${names}`,
          link: '/',
          icon: Users,
        });
      }
    }

    // Check event reminder setting
    const eventRemindersEnabled = localStorage.getItem('notif_event_reminders') !== 'false';
    if (eventRemindersEnabled && eventsQuery.data) {
      const upcomingEvents = eventsQuery.data.filter(e => {
        const eventDate = new Date(e.start_time);
        return isToday(eventDate) || isTomorrow(eventDate);
      });

      upcomingEvents.forEach(event => {
        const eventDate = new Date(event.start_time);
        const timeStr = isToday(eventDate) ? 'Today' : 'Tomorrow';
        newNotifications.push({
          id: `event-${event.id}`,
          type: 'event',
          title: `📅 ${timeStr}'s Event`,
          message: `${event.title} at ${format(eventDate, 'h:mm a')}`,
          link: '/events',
          icon: Calendar,
        });
      });
    }

    // Filter out dismissed notifications
    const activeNotifications = newNotifications.filter(n => !dismissedIds.has(n.id));
    setNotifications(activeNotifications);
  }, [birthdaysQuery.data, eventsQuery.data, dismissedIds]);

  const handleDismiss = (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissed_notifications', JSON.stringify([...newDismissed]));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((notif) => {
        const Icon = notif.icon;
        return (
          <div
            key={notif.id}
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">{notif.title}</p>
              <p className="text-sm text-amber-800">{notif.message}</p>
              {notif.link && (
                <Link
                  to={notif.link}
                  className="mt-1 inline-block text-xs font-medium text-amber-700 hover:underline"
                >
                  View details →
                </Link>
              )}
            </div>
            <button
              onClick={() => handleDismiss(notif.id)}
              className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
