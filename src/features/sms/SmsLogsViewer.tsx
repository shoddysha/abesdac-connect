import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  MessageSquare, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, Trash2, Loader2,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchSmsLogs, fetchSmsRecipients, deleteSmsLog } from '@/services/sms';
import toast from 'react-hot-toast';
import type { SmsStatus } from '@/types/database';

export function SmsLogsViewer() {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: () => fetchSmsLogs(),
  });

  const { data: recipients = [], isFetching: recipientsFetching } = useQuery({
    queryKey: ['sms-recipients', expandedLogId],
    queryFn: () => fetchSmsRecipients(expandedLogId!),
    enabled: !!expandedLogId,
  });

  function getStatusTone(status: SmsStatus): 'slate' | 'green' | 'red' | 'amber' {
    switch (status) {
      case 'sent':      return 'green';
      case 'failed':    return 'red';
      case 'cancelled': return 'slate';
      case 'pending':   return 'amber';
      default:          return 'slate';
    }
  }

  function getTypeLabel(type: string): string {
    switch (type) {
      case 'event_notification': return 'Event';
      case 'event_reminder':     return 'Event Reminder';
      case 'announcement':       return 'Announcement';
      case 'manual':             return 'Manual';
      default:                   return type;
    }
  }

  function toggleExpand(logId: string) {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  }

  async function handleDeleteLog(logId: string) {
    if (!window.confirm('Delete this failed SMS log? All recipient records will also be removed.')) return;

    setDeletingId(logId);
    try {
      await deleteSmsLog(logId);

      // Clear expand state if the deleted log was open
      if (expandedLogId === logId) setExpandedLogId(null);

      toast.success('SMS log deleted');
      
      // Force refetch to update the UI immediately
      await queryClient.refetchQueries({ queryKey: ['sms-logs'] });
    } catch (err) {
      toast.error((err as Error).message || 'Failed to delete SMS log');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="SMS History"
        action={<MessageSquare className="h-4 w-4 text-slate-400" />}
      />
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        Showing latest 5 SMS messages. Failed messages can be deleted.
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
          {logs.map((log: any) => {
            const isDeleting = deletingId === log.id;
            const isFailed   = log.status === 'failed';

            return (
              <div
                key={log.id}
                className="overflow-hidden rounded-lg border border-slate-200 transition-colors hover:border-slate-300"
              >
                {/* ── Row header ── */}
                <div className="flex items-start gap-2 p-3">
                  {/* Clickable summary area → toggles recipients */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(log.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={getStatusTone(log.status as SmsStatus)}>{log.status}</Badge>
                      <span className="text-xs text-slate-500">{getTypeLabel(log.type)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{log.message}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>
                        {format(new Date(log.sent_at || log.created_at), 'MMM d, yyyy · h:mm a')}
                      </span>
                      <span>By {log.profiles?.full_name || 'Unknown'}</span>
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
                  </button>

                  {/* Action buttons — kept separate from the expand button */}
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Delete — only for failed logs */}
                    {isFailed && (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDeleteLog(log.id)}
                        className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete failed SMS log"
                        aria-label="Delete failed SMS log"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    {/* Expand / collapse */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(log.id)}
                      className="rounded-md p-2 text-slate-400 hover:bg-slate-100"
                      title={expandedLogId === log.id ? 'Hide recipients' : 'View recipients'}
                    >
                      {expandedLogId === log.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Expanded recipients ── */}
                {expandedLogId === log.id && (
                  <div className="border-t border-slate-200 bg-slate-50 p-3">
                    <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                      Recipients
                    </h4>
                    {recipientsFetching ? (
                      <Spinner />
                    ) : recipients.length === 0 ? (
                      <p className="text-sm text-slate-500">No recipient records found.</p>
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
                              <Badge tone={getStatusTone(recipient.status as SmsStatus)}>
                                {recipient.status}
                              </Badge>
                              {recipient.status === 'sent'    && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              {recipient.status === 'failed'  && <XCircle      className="h-4 w-4 text-red-600"   />}
                              {recipient.status === 'pending' && <Clock        className="h-4 w-4 text-amber-600" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
