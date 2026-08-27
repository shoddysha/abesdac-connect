import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Filter, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotificationQueue,
  fetchNotificationLogs,
  getNotificationStats,
  getWorkflowStats,
} from '@/services/notifications';
import type { NotificationStatus, NotificationWorkflowType } from '@/types/notifications';
import { format } from 'date-fns';

export function NotificationHistory() {
  const { hasRole } = useAuth();
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'all'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<NotificationWorkflowType | 'all'>('all');

  const canView = hasRole('administrator', 'secretary');

  const queueQuery = useQuery({
    queryKey: ['notification-queue'],
    queryFn: () => fetchNotificationQueue(undefined, 200),
    enabled: canView,
  });

  const logsQuery = useQuery({
    queryKey: ['notification-logs'],
    queryFn: () => fetchNotificationLogs(50),
    enabled: canView,
  });

  const statsQuery = useQuery({
    queryKey: ['notification-stats'],
    queryFn: getNotificationStats,
    enabled: canView,
  });

  const workflowStatsQuery = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: getWorkflowStats,
    enabled: canView,
  });

  const queue = queueQuery.data || [];
  const logs = logsQuery.data || [];
  const stats = statsQuery.data;
  const workflowStats = workflowStatsQuery.data || [];

  const filteredQueue = queue.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (workflowFilter !== 'all' && item.workflow_type !== workflowFilter) return false;
    return true;
  });

  if (!canView) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Notification History</h1>
        <EmptyState
          icon={Bell}
          title="Access Denied"
          description="Only administrators and secretaries can view notification history"
        />
      </div>
    );
  }

  if (queueQuery.isLoading || statsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Notification History</h1>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">Notification History</h1>
        <p className="text-sm text-slate-500 mt-1">
          View all sent and pending notifications
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Sent</p>
                <p className="text-2xl font-bold text-ink">{stats.total_sent}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Successful</p>
                <p className="text-2xl font-bold text-green-600">{stats.successful}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Workflow Stats */}
      {workflowStats.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-ink mb-4">Workflow Performance</h3>
          <div className="space-y-3">
            {workflowStats.map((ws) => (
              <div
                key={ws.workflow_type}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{ws.workflow_name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {ws.successful} sent • {ws.failed} failed • {ws.pending} pending
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      ws.success_rate >= 90
                        ? 'green'
                        : ws.success_rate >= 70
                        ? 'amber'
                        : 'red'
                    }
                  >
                    {ws.success_rate.toFixed(0)}% success
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'sent', label: 'Sent' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
            <Select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'All Workflows' },
                { value: 'birthday_greeting', label: 'Birthday Greetings' },
                { value: 'anniversary_greeting', label: 'Anniversary Greetings' },
                { value: 'new_visitor_followup', label: 'Visitor Follow-up' },
                { value: 'inactive_member_reengagement', label: 'Inactive Members' },
                { value: 'event_reminder', label: 'Event Reminders' },
                { value: 'ministry_leader_reminder', label: 'Leader Reminders' },
                { value: 'first_attendance_celebration', label: 'First Attendance' },
                { value: 'prayer_answered_followup', label: 'Prayer Answered' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Notification Queue */}
      <Card>
        <h3 className="text-lg font-semibold text-ink mb-4">
          Notification Queue ({filteredQueue.length})
        </h3>
        {filteredQueue.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications found"
            description="No notifications match your filters"
          />
        ) : (
          <div className="space-y-2">
            {filteredQueue.slice(0, 50).map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      tone={
                        item.status === 'sent'
                          ? 'green'
                          : item.status === 'failed'
                          ? 'red'
                          : 'amber'
                      }
                    >
                      {item.status}
                    </Badge>
                    <span className="text-xs text-slate-500 capitalize">
                      {item.workflow_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {item.recipient_name || 'Unknown'} • {item.recipient_phone}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {item.sent_at
                      ? `Sent: ${format(new Date(item.sent_at), 'MMM d, yyyy h:mm a')}`
                      : `Scheduled: ${format(new Date(item.scheduled_for), 'MMM d, yyyy h:mm a')}`}
                  </p>
                  {item.error_message && (
                    <p className="text-xs text-red-600 mt-1">Error: {item.error_message}</p>
                  )}
                </div>
              </div>
            ))}
            {filteredQueue.length > 50 && (
              <p className="text-center text-sm text-slate-500 pt-2">
                Showing 50 of {filteredQueue.length} notifications
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Recent Logs */}
      <Card>
        <h3 className="text-lg font-semibold text-ink mb-4">Recent Workflow Executions</h3>
        {logs.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No execution logs yet"
            description="Workflow execution history will appear here"
          />
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink capitalize">
                    {log.workflow_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {log.recipient_count} recipients • {log.successful_count} sent •{' '}
                    {log.failed_count} failed
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {format(new Date(log.triggered_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <Badge
                  tone={
                    log.failed_count === 0
                      ? 'green'
                      : log.successful_count > log.failed_count
                      ? 'amber'
                      : 'red'
                  }
                >
                  {log.failed_count === 0 ? 'Success' : 'Partial'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
