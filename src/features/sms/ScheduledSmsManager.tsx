import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Clock, Trash2, Edit2, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Textarea, Select } from '@/components/ui/Input';
import {
  fetchScheduledSms,
  cancelScheduledSms,
  deleteScheduledSms,
  updateScheduledSms,
} from '@/services/sms';
import { fetchMinistries } from '@/services/ministries';
import type { ScheduledSms, SmsStatus } from '@/types/database';
import toast from 'react-hot-toast';

export function ScheduledSmsManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editRecipientType, setEditRecipientType] = useState<'all' | 'ministry'>('all');
  const [editMinistryId, setEditMinistryId] = useState('');

  const { data: scheduledSms = [], isLoading } = useQuery({
    queryKey: ['scheduled-sms'],
    queryFn: fetchScheduledSms,
  });

  const { data: ministries = [] } = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
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

  function openEdit(sms: ScheduledSms) {
    setEditingId(sms.id);
    setEditMessage(sms.message);
    if (sms.recipient_filters?.ministry_id) {
      setEditRecipientType('ministry');
      setEditMinistryId(sms.recipient_filters.ministry_id);
    } else {
      setEditRecipientType('all');
      setEditMinistryId('');
    }
  }

  async function handleUpdate() {
    if (!editingId || !editMessage.trim()) {
      toast.error('Message is required');
      return;
    }

    try {
      await updateScheduledSms(editingId, {
        message: editMessage,
        recipient_filters:
          editRecipientType === 'all'
            ? { all_members: true }
            : { ministry_id: editMinistryId },
      });
      toast.success('Scheduled SMS updated');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['scheduled-sms'] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this scheduled SMS?')) return;

    try {
      await cancelScheduledSms(id);
      toast.success('Scheduled SMS cancelled');
      queryClient.invalidateQueries({ queryKey: ['scheduled-sms'] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this scheduled SMS?')) return;

    try {
      await deleteScheduledSms(id);
      toast.success('Scheduled SMS deleted');
      queryClient.invalidateQueries({ queryKey: ['scheduled-sms'] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const pendingSms = scheduledSms.filter((s) => s.status === 'pending');
  const completedSms = scheduledSms.filter((s) => s.status !== 'pending');

  return (
    <Card>
      <CardHeader
        title="Scheduled SMS"
        description="Manage automatic SMS reminders for upcoming events"
        action={<Clock className="h-4 w-4 text-slate-400" />}
      />

      {isLoading ? (
        <Spinner />
      ) : scheduledSms.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No scheduled SMS"
          description="SMS reminders will appear here when you schedule them for events"
        />
      ) : (
        <div className="space-y-6">
          {/* Pending SMS */}
          {pendingSms.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">Pending ({pendingSms.length})</h3>
              <div className="space-y-2">
                {pendingSms.map((sms: any) => (
                  <div
                    key={sms.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 hover:border-slate-300"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-ink">
                          {sms.events?.title || 'Event Reminder'}
                        </h4>
                        <Badge tone={getStatusTone(sms.status)}>{sms.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{sms.message}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Scheduled for {format(new Date(sms.scheduled_for), 'EEE, MMM d, yyyy · h:mm a')}
                        </span>
                        <span>
                          Recipients:{' '}
                          {sms.recipient_filters?.all_members
                            ? 'All members'
                            : sms.recipient_filters?.ministry_id
                            ? ministries.find((m) => m.id === sms.recipient_filters.ministry_id)
                                ?.name || 'Ministry'
                            : 'Selected members'}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(sms)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleCancel(sms.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        title="Cancel"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(sms.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed SMS */}
          {completedSms.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">History ({completedSms.length})</h3>
              <div className="space-y-2">
                {completedSms.map((sms: any) => (
                  <div
                    key={sms.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-700">
                          {sms.events?.title || 'Event Reminder'}
                        </h4>
                        <Badge tone={getStatusTone(sms.status)}>{sms.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{sms.message}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                        <span>
                          {sms.status === 'sent' ? 'Sent' : 'Scheduled for'}{' '}
                          {format(
                            new Date(sms.sent_at || sms.scheduled_for),
                            'MMM d, yyyy · h:mm a'
                          )}
                        </span>
                      </div>
                    </div>
                    {sms.status === 'sent' && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                    )}
                    {sms.status === 'failed' && (
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                    )}
                    {sms.status === 'cancelled' && (
                      <XCircle className="h-5 w-5 shrink-0 text-slate-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={!!editingId}
        onClose={() => setEditingId(null)}
        title="Edit Scheduled SMS"
        size="md"
      >
        <div className="space-y-4">
          <Textarea
            label="Message"
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            rows={4}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink">Recipients</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditRecipientType('all')}
                className={`flex-1 rounded-lg border-2 p-2 text-sm transition-colors ${
                  editRecipientType === 'all'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                All Members
              </button>
              <button
                type="button"
                onClick={() => setEditRecipientType('ministry')}
                className={`flex-1 rounded-lg border-2 p-2 text-sm transition-colors ${
                  editRecipientType === 'ministry'
                    ? 'border-primary bg-primary-50 text-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                By Ministry
              </button>
            </div>

            {editRecipientType === 'ministry' && (
              <Select
                value={editMinistryId}
                onChange={(e) => setEditMinistryId(e.target.value)}
                options={ministries.map((m) => ({ value: m.id, label: m.name }))}
                placeholder="Select a ministry"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
