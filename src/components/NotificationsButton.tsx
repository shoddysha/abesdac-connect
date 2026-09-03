import { useState } from 'react';
import { Bell, Megaphone, FileText, Heart, Calendar, Users, CheckCircle, BookOpen, CreditCard, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchAnnouncementsWithViewStatus, markAnnouncementAsViewed } from '@/services/announcements';
import { fetchAllMinistryReports } from '@/services/ministryReports';
import { getUpcomingDeadlines, getOverdueDeadlines } from '@/services/reportDeadlines';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/utils/cn';
import { formatDistanceToNow, format } from 'date-fns';

type NotificationCategory = 'all' | 'unread' | 'announcements' | 'reports' | 'followups' | 'events' | 'attendance';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  icon: any;
  iconBg: string;
  iconColor: string;
  category: string;
  badge: string;
  badgeColor: string;
  link?: string;
}

export function NotificationsButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const { data: counts } = useNotificationCounts();
  const { hasRole, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch unviewed announcements
  const { data: announcements } = useQuery({
    queryKey: ['announcements-with-views'],
    queryFn: fetchAnnouncementsWithViewStatus,
    enabled: modalOpen,
  });

  // Fetch unacknowledged ministry reports (admin/secretary only)
  const { data: ministryReports } = useQuery({
    queryKey: ['unacknowledged-reports'],
    queryFn: async () => {
      const reports = await fetchAllMinistryReports();
      return reports.filter(r => !r.acknowledged_at);
    },
    enabled: modalOpen && hasRole('administrator', 'secretary'),
  });

  // Fetch deadlines (ministry leaders only)
  const { data: upcomingDeadlines } = useQuery({
    queryKey: ['my-upcoming-deadlines'],
    queryFn: async () => profile?.id ? await getUpcomingDeadlines(profile.id) : [],
    enabled: modalOpen && hasRole('ministry_leader') && !!profile?.id,
  });

  const { data: overdueDeadlines } = useQuery({
    queryKey: ['my-overdue-deadlines'],
    queryFn: async () => profile?.id ? await getOverdueDeadlines(profile.id) : [],
    enabled: modalOpen && hasRole('ministry_leader') && !!profile?.id,
  });

  const allDeadlines = [...(upcomingDeadlines || []), ...(overdueDeadlines || [])];

  const markViewedMutation = useMutation({
    mutationFn: markAnnouncementAsViewed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-counts'] });
      queryClient.invalidateQueries({ queryKey: ['announcements-with-views'] });
    },
  });

  // Build notifications array
  const allNotifications: Notification[] = [];

  // Add announcements
  if (announcements) {
    announcements
      .filter(a => !a.has_viewed)
      .slice(0, 20) // Limit to recent 20
      .forEach(announcement => {
        allNotifications.push({
          id: `announcement-${announcement.id}`,
          type: 'announcement',
          title: announcement.title,
          message: announcement.content.substring(0, 150) + (announcement.content.length > 150 ? '...' : ''),
          timestamp: announcement.published_at,
          isRead: false,
          icon: Megaphone,
          iconBg: 'bg-purple-50',
          iconColor: 'text-purple-600',
          category: 'Announcement',
          badge: 'Announcement',
          badgeColor: 'purple',
          link: '/announcements',
        });
      });
  }

  // Add ministry reports with details
  if (ministryReports && ministryReports.length > 0) {
    ministryReports.slice(0, 10).forEach(report => {
      allNotifications.push({
        id: `report-${report.id}`,
        type: 'report',
        title: `New Report: ${report.title}`,
        message: `${report.ministry_name || 'Unknown Ministry'} - ${report.submitter_name || 'Unknown'} submitted ${report.report_type} report for ${report.report_period}`,
        timestamp: report.created_at,
        isRead: false,
        icon: FileText,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        category: 'Reports',
        badge: 'Reports',
        badgeColor: 'blue',
        link: '/all-ministry-reports',
      });
    });
  }

  // Add deadlines with details
  if (allDeadlines && allDeadlines.length > 0) {
    const now = new Date();
    allDeadlines
      .filter(d => !d.is_completed)
      .slice(0, 10)
      .forEach(deadline => {
        const deadlineDate = new Date(deadline.deadline_date);
        const isOverdue = deadlineDate < now;
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        allNotifications.push({
          id: `deadline-${deadline.id}`,
          type: 'deadline',
          title: isOverdue ? '⚠️ Overdue Report' : `Report Due ${daysUntil === 0 ? 'Today' : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}`,
          message: `${deadline.report_type?.toUpperCase()} report for ${deadline.report_period} - Due: ${format(deadlineDate, 'MMM d, yyyy')}`,
          timestamp: deadline.deadline_date,
          isRead: false,
          icon: isOverdue ? Calendar : Clock,
          iconBg: isOverdue ? 'bg-red-50' : 'bg-amber-50',
          iconColor: isOverdue ? 'text-red-600' : 'text-amber-600',
          category: 'Attendance',
          badge: isOverdue ? 'Overdue' : 'Deadline',
          badgeColor: isOverdue ? 'red' : 'amber',
          link: '/submit-ministry-report',
        });
      });
  }

  // Sort by timestamp (newest first)
  allNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter by category
  const filteredNotifications = allNotifications.filter(notification => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !notification.isRead;
    if (activeTab === 'announcements') return notification.type === 'announcement';
    if (activeTab === 'reports') return notification.type === 'report';
    if (activeTab === 'followups') return notification.type === 'followup';
    if (activeTab === 'events') return notification.type === 'event';
    if (activeTab === 'attendance') return notification.type === 'deadline';
    return true;
  });

  const unreadCount = allNotifications.filter(n => !n.isRead).length;
  const totalCount = allNotifications.length;

  function handleNotificationClick(notification: Notification) {
    if (notification.link) {
      navigate(notification.link);
      setModalOpen(false);
    }
  }

  function handleMarkAllRead() {
    // Mark all announcements as viewed
    if (announcements) {
      announcements
        .filter(a => !a.has_viewed)
        .forEach(announcement => {
          markViewedMutation.mutate(announcement.id);
        });
    }
  }

  return (
    <>
      {/* Notification Icon with Badge */}
      <button
        onClick={() => setModalOpen(true)}
        className="relative p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors"
        title="View notifications"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {totalCount}
          </span>
        )}
      </button>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title=""
        size="xl"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
              <p className="text-sm text-slate-500 mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-slate-600"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark All Read
              </Button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-2',
                activeTab === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Unread
              {unreadCount > 0 && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-semibold",
                  activeTab === 'unread' ? 'bg-white text-blue-600' : 'bg-amber-500 text-white'
                )}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                activeTab === 'announcements'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Announcement
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Reports
            </button>
            <button
              onClick={() => setActiveTab('followups')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                activeTab === 'followups'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Follow-ups
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors',
                activeTab === 'attendance'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              Attendance
            </button>
          </div>

          {/* Notifications List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications"
                description={activeTab === 'all' ? "You're all caught up!" : `No ${activeTab} notifications`}
              />
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all hover:shadow-md border',
                    notification.isRead ? 'bg-white border-slate-200' : 'bg-blue-50/30 border-blue-200'
                  )}
                >
                  {/* Icon */}
                  <div className={cn('p-2 rounded-lg shrink-0', notification.iconBg)}>
                    <notification.icon className={cn('h-5 w-5', notification.iconColor)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{notification.title}</h4>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                        </span>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                    <div className="flex items-center gap-2">
                      <Badge tone={notification.badgeColor as any}>{notification.badge}</Badge>
                      {notification.isRead && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Mark read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
