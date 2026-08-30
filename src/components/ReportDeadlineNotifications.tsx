import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, CheckCircle, X, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { 
  fetchLeaderDeadlineNotifications, 
  markNotificationAsRead,
  dismissNotification,
  getUpcomingDeadlines,
  getOverdueDeadlines 
} from '@/services/reportDeadlines';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

interface ReportDeadlineNotificationsProps {
  variant?: 'compact' | 'full';
  onNavigateToSubmit?: () => void;
}

export function ReportDeadlineNotifications({ 
  variant = 'full',
  onNavigateToSubmit 
}: ReportDeadlineNotificationsProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['deadline-notifications', profile?.id],
    queryFn: () => fetchLeaderDeadlineNotifications(profile?.id || '', false),
    enabled: !!profile?.id,
  });

  const upcomingQuery = useQuery({
    queryKey: ['upcoming-deadlines', profile?.id],
    queryFn: () => getUpcomingDeadlines(profile?.id || ''),
    enabled: !!profile?.id,
  });

  const overdueQuery = useQuery({
    queryKey: ['overdue-deadlines', profile?.id],
    queryFn: () => getOverdueDeadlines(profile?.id || ''),
    enabled: !!profile?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadline-notifications'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadline-notifications'] });
      toast.success('Notification dismissed');
    },
  });

  const notifications = notificationsQuery.data || [];
  const upcomingDeadlines = upcomingQuery.data || [];
  const overdueDeadlines = overdueQuery.data || [];

  const allDeadlines = [...overdueDeadlines, ...upcomingDeadlines];

  if (variant === 'compact') {
    if (allDeadlines.length === 0) return null;

    return (
      <Card className="bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-amber-900 mb-1">
              {overdueDeadlines.length > 0 ? 'Overdue Reports' : 'Upcoming Report Deadlines'}
            </h3>
            <p className="text-sm text-amber-800 mb-3">
              You have {overdueDeadlines.length > 0 ? overdueDeadlines.length : upcomingDeadlines.length} report{allDeadlines.length !== 1 ? 's' : ''} {overdueDeadlines.length > 0 ? 'overdue' : 'due soon'}.
            </p>
            {onNavigateToSubmit && (
              <Button size="sm" onClick={onNavigateToSubmit}>
                Submit Report
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (allDeadlines.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No pending deadlines"
        description="You're all caught up with report submissions"
      />
    );
  }

  return (
    <div className="space-y-3">
      {overdueDeadlines.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Overdue Reports ({overdueDeadlines.length})
          </h3>
          {overdueDeadlines.map((deadline) => {
            const notification = notifications.find((n) => n.deadline?.id === deadline.id);
            return (
              <Card key={deadline.id} className="bg-red-50 border-red-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge tone="red">Overdue</Badge>
                      <Badge tone="slate">{deadline.report_type}</Badge>
                    </div>
                    <h4 className="font-semibold text-red-900 mb-1">{deadline.title}</h4>
                    <p className="text-sm text-red-700 mb-2">
                      {deadline.ministry_name} • {deadline.report_period}
                    </p>
                    {deadline.description && (
                      <p className="text-sm text-red-600 mb-2">{deadline.description}</p>
                    )}
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Was due {formatDistanceToNow(new Date(deadline.deadline_date))} ago
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {notification && !notification.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        title="Mark as read"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {notification && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissMutation.mutate(notification.id)}
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {onNavigateToSubmit && (
                  <Button size="sm" onClick={onNavigateToSubmit} className="mt-3 w-full">
                    Submit Report Now
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {upcomingDeadlines.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming Deadlines ({upcomingDeadlines.length})
          </h3>
          {upcomingDeadlines.map((deadline) => {
            const notification = notifications.find((n) => n.deadline?.id === deadline.id);
            const daysUntil = differenceInDays(new Date(deadline.deadline_date), new Date());
            return (
              <Card key={deadline.id} className="bg-amber-50 border-amber-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge tone="amber">Due in {daysUntil} day{daysUntil !== 1 ? 's' : ''}</Badge>
                      <Badge tone="slate">{deadline.report_type}</Badge>
                    </div>
                    <h4 className="font-semibold text-amber-900 mb-1">{deadline.title}</h4>
                    <p className="text-sm text-amber-700 mb-2">
                      {deadline.ministry_name} • {deadline.report_period}
                    </p>
                    {deadline.description && (
                      <p className="text-sm text-amber-600 mb-2">{deadline.description}</p>
                    )}
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due {format(new Date(deadline.deadline_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {notification && !notification.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        title="Mark as read"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {notification && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissMutation.mutate(notification.id)}
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {onNavigateToSubmit && (
                  <Button size="sm" variant="outline" onClick={onNavigateToSubmit} className="mt-3 w-full">
                    Submit Report
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
