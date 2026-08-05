import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageSquare, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchSmsLogs, fetchSmsRecipients } from '@/services/sms';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import type { SmsLog, SmsStatus } from '@/types/database';

export function SmsLogsViewer() {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: () => fetchSmsLogs(),
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ['sms-recipients', expandedLogId],
    queryFn: () => fetchSmsRecipients(expandedLogId!),
    enabled: !!expandedLogId,
  });

  function getStatusTone(status: SmsStatus): 'slate' | 'green' | 'red' | 'amber' {
    switch (status) {
      case 'sent':
        return 'green';
      case 'failed':
        return 'red';
      case 'cancelled':
        return 'slate';
      case 'pending':
        return 'amber';
      default:
        return 'slate';
    }
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case 'event_notification':
        return 'Event';
      case 'event_reminder':
        return 'Event Reminder';
      case 'announcement':
        return 'Announcement';
      case 'manual':
        return 'Manual';
      default:
        return type;
    }
  }

  function toggleExpand(logId: string) {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  }

  async function handleDeleteLog(logId: string) {
    if (!confirm('Delete this SMS log? This will also delete all recipient records.')) return;

    try {
      // Delete SMS log (recipients will be deleted via cascade)
      const { error } = await supabase.from('sms_logs').delete().eq('id', logId);

      if (error) throw error;

      toast.success('SMS log deleted');
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete SMS log');
    }
  }

  return (
    <Card>
      <CardHeader
        title="SMS History"
        action={<MessageSquare className="h-4 w-4 text-slate-400" />}
      />
      <p className="mb-4 -mt-2 text-sm text-slate-500">
        View all sent SMS messages and their delivery status
      </p>

      {isLoading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No SMS sent yet"
          description="Your SMS history will appear here once you send messages"
        />
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div
              key={log.id}
              className="overflow-hidden rounded-lg border border-slate-200 transition-colors hover:border-slate-300"
            >
              {/* Log Header */}
              <div className="flex items-start justify-between gap-4 p-3">
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="flex min-w-0 flex-1 items-start gap-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={getStatusTone(log.status)}>{log.status}</Badge>
                      <span className="text-xs text-slate-500">{getTypeLabel(log.type)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{log.message}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>
                        {format(new Date(log.sent_at || log.created_at), 'MMM d, yyyy · h:mm a')}
                      </span>
                      <span>Sent by {log.profiles?.full_name || 'Unknown'}</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        {log.successful_count} sent
                      </span>
                      {log.failed_count > 0 && (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-600" />
                          {log.failed_count} failed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {expandedLogId === log.id ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Delete Button - Only show for failed SMS */}
                {log.status === 'failed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLog(log.id);
                    }}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete failed SMS log"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Expanded Recipients */}
              {expandedLogId === log.id && (
                <div className="border-t border-slate-200 bg-slate-50 p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                    Recipients ({recipients.length})
                  </h4>
                  {recipients.length === 0 ? (
                    <p className="text-sm text-slate-500">Loading recipients...</p>
                  ) : (
                    <div className="space-y-1">
                      {recipients.map((recipient: any) => (
                        <div
                          key={recipient.id}
                          className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium text-ink">
                              {recipient.members?.first_name} {recipient.members?.last_name}
                            </span>
                            <span className="ml-2 text-xs text-slate-500">
                              {recipient.phone_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tone={getStatusTone(recipient.status)}>
                              {recipient.status}
                            </Badge>
                            {recipient.status === 'sent' && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                            {recipient.status === 'failed' && (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            {recipient.status === 'pending' && (
                              <Clock className="h-4 w-4 text-amber-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
