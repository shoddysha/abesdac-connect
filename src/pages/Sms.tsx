import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  MessageSquare,
  Send,
  Clock,
  Users,
  Filter,
  CheckCircle2,
  AlertCircle,
  Bell,
  Settings,
  History,
  BellOff,
  Save,
  Play,
  XCircle,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea, Select } from '@/components/ui/Input';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMinistries } from '@/services/ministries';
import { fetchMembers } from '@/services/members';
import { sendBulkSms, fetchSmsLogs } from '@/services/sms';
import { SmsLogsViewer } from '@/features/sms/SmsLogsViewer';
import { RecurringServiceReminders } from '@/features/sms/RecurringServiceReminders';
import {
  fetchNotificationWorkflows,
  updateNotificationWorkflow,
  checkAllWorkflows,
  processPendingNotifications,
  fetchNotificationQueue,
  fetchNotificationLogs,
  getNotificationStats,
  getWorkflowStats,
} from '@/services/notifications';
import type { RecipientFilters } from '@/types/database';
import type { NotificationWorkflow, NotificationStatus, NotificationWorkflowType } from '@/types/notifications';

const bulkSmsSchema = z.object({
  message: z.string().min(1, 'Message is required').max(500, 'Message too long'),
  recipientType: z.enum(['all', 'ministry', 'manual']),
  ministryId: z.string().optional(),
});

type BulkSmsFormValues = z.infer<typeof bulkSmsSchema>;
type RecipientType = 'all' | 'ministry' | 'manual';
type Tab = 'sms' | 'notifications' | 'history';

export function Sms() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('sms');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  
  // Notification Settings State
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  
  // Notification History State
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'all'>('all');
  const [workflowFilter, setWorkflowFilter] = useState<NotificationWorkflowType | 'all'>('all');

  const canManageNotifications = hasRole('administrator', 'secretary');

  const { data: ministries = [] } = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => fetchMembers({ status: 'active' }),
  });

  const { data: smsLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['sms-logs'],
    queryFn: () => fetchSmsLogs(),
  });

  // Notification Workflows Query
  const workflowsQuery = useQuery({
    queryKey: ['notification-workflows'],
    queryFn: fetchNotificationWorkflows,
    enabled: canManageNotifications && activeTab === 'notifications',
  });

  // Notification Queue Query
  const queueQuery = useQuery({
    queryKey: ['notification-queue'],
    queryFn: () => fetchNotificationQueue(undefined, 200),
    enabled: canManageNotifications && activeTab === 'history',
  });

  // Notification Logs Query
  const notificationLogsQuery = useQuery({
    queryKey: ['notification-logs'],
    queryFn: () => fetchNotificationLogs(50),
    enabled: canManageNotifications && activeTab === 'history',
  });

  // Notification Stats Query
  const statsQuery = useQuery({
    queryKey: ['notification-stats'],
    queryFn: getNotificationStats,
    enabled: canManageNotifications && activeTab === 'history',
  });

  // Workflow Stats Query
  const workflowStatsQuery = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: getWorkflowStats,
    enabled: canManageNotifications && activeTab === 'history',
  });

  // Mutations for Notification Settings
  const updateWorkflowMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NotificationWorkflow> }) =>
      updateNotificationWorkflow(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-workflows'] });
      toast.success('Workflow updated successfully');
      setEditingWorkflowId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const testWorkflowMutation = useMutation({
    mutationFn: async () => {
      const result = await checkAllWorkflows();
      const total = Object.values(result).reduce((sum, val) => sum + val, 0);
      return { result, total };
    },
    onSuccess: ({ result, total }) => {
      queryClient.invalidateQueries({ queryKey: ['notification-workflows'] });
      toast.success(
        `Checked all workflows: ${total} notifications queued (Birthdays: ${result.birthdays}, Visitors: ${result.visitors}, Inactive: ${result.inactive}, Events: ${result.events})`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const processMutation = useMutation({
    mutationFn: processPendingNotifications,
    onSuccess: ({ sent, failed }) => {
      toast.success(`Processed: ${sent} sent, ${failed} failed`);
      queryClient.invalidateQueries({ queryKey: ['notification-queue'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const resetHistoryMutation = useMutation({
    mutationFn: async () => {
      const { supabase } = await import('@/lib/supabase');
      
      // First, get all notification IDs
      const { data: notifications, error: fetchError } = await supabase
        .from('notification_queue')
        .select('id');
      
      if (fetchError) throw fetchError;
      
      console.log('Notifications to delete:', notifications);
      
      if (!notifications || notifications.length === 0) {
        return 0;
      }
      
      // Delete all notification queue records using the IDs
      const ids = notifications.map(n => n.id);
      console.log('Deleting notification IDs:', ids);
      
      const { error, count } = await supabase
        .from('notification_queue')
        .delete({ count: 'exact' })
        .in('id', ids);
      
      if (error) {
        console.error('Delete error:', error);
        throw error;
      }
      
      console.log('Delete result count:', count);
      return count;
    },
    onSuccess: (count) => {
      toast.success(`Notification history cleared successfully (${count || 0} records deleted)`);
      queryClient.invalidateQueries({ queryKey: ['notification-queue'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to clear history: ${err.message}`);
    },
  });

  const handleResetHistory = () => {
    if (window.confirm('Are you sure you want to clear all notification history? This action cannot be undone.')) {
      resetHistoryMutation.mutate();
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BulkSmsFormValues>({
    resolver: zodResolver(bulkSmsSchema),
    defaultValues: {
      message: '',
      recipientType: 'all',
      ministryId: '',
    },
  });

  const message = watch('message');
  const recipientType = watch('recipientType') as RecipientType;
  const ministryId = watch('ministryId');

  const messageLength = message?.length || 0;
  const smsCount = Math.ceil(messageLength / 160) || 1;

  // Calculate recipient count
  useEffect(() => {
    async function calculateCount() {
      if (recipientType === 'all') {
        const allMembers = await fetchMembers({});
        // Filter for active, non-archived members with phone numbers
        const eligible = allMembers.filter((m) => 
          m.status === 'active' && 
          !m.is_archived && 
          m.phone && 
          m.phone.trim() !== ''
        );
        setRecipientCount(eligible.length);
      } else if (recipientType === 'ministry' && ministryId) {
        const ministryMembers = await fetchMembers({ ministryId });
        const eligible = ministryMembers.filter((m) => 
          m.status === 'active' && 
          !m.is_archived && 
          m.phone && 
          m.phone.trim() !== ''
        );
        setRecipientCount(eligible.length);
      } else if (recipientType === 'manual') {
        setRecipientCount(selectedMembers.length);
      } else {
        setRecipientCount(0);
      }
    }
    calculateCount();
  }, [recipientType, ministryId, selectedMembers]);

  async function onSubmit(values: BulkSmsFormValues) {
    if (recipientCount === 0) {
      toast.error('No recipients selected');
      return;
    }

    const filters: RecipientFilters = {};

    if (values.recipientType === 'all') {
      filters.all_members = true;
    } else if (values.recipientType === 'ministry' && values.ministryId) {
      filters.ministry_id = values.ministryId;
    } else if (values.recipientType === 'manual' && selectedMembers.length > 0) {
      filters.member_ids = selectedMembers;
    } else {
      toast.error('Please select recipients');
      return;
    }

    const confirmed = confirm(
      `Send SMS to ${recipientCount} recipient(s)?\n\nThis will send approximately ${
        recipientCount * smsCount
      } SMS message(s).`
    );

    if (!confirmed) return;

    setIsSending(true);

    try {
      const result = await sendBulkSms(values.message, filters, 'manual');

      if (result.success) {
        toast.success(result.message);
        reset();
        setSelectedMembers([]);
        queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error((error as Error).message || 'Failed to send SMS');
    } finally {
      setIsSending(false);
    }
  }

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllMembers = () => {
    const allMemberIds = members.filter((m) => m.phone).map((m) => m.id);
    setSelectedMembers(allMemberIds);
  };

  const clearSelection = () => {
    setSelectedMembers([]);
  };

  const totalSent = smsLogs.filter((log) => log.status === 'sent').length;
  const totalFailed = smsLogs.filter((log) => log.status === 'failed').length;
  const successRate =
    totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0;

  // Notification Settings Helper Functions
  function handleToggleWorkflow(workflow: NotificationWorkflow) {
    updateWorkflowMutation.mutate({
      id: workflow.id,
      updates: { is_active: !workflow.is_active },
    });
  }

  function handleSaveMessage(workflow: NotificationWorkflow) {
    updateWorkflowMutation.mutate({
      id: workflow.id,
      updates: { message_template: editMessage },
    });
  }

  function startEditingWorkflow(workflow: NotificationWorkflow) {
    setEditingWorkflowId(workflow.id);
    setEditMessage(workflow.message_template);
  }

  // Notification History Data
  const queue = queueQuery.data || [];
  const notificationLogs = notificationLogsQuery.data || [];
  const notificationStats = statsQuery.data;
  const workflowStats = workflowStatsQuery.data || [];
  const workflows = workflowsQuery.data || [];

  const filteredQueue = queue.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (workflowFilter !== 'all' && item.workflow_type !== workflowFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ink">SMS & Notifications</h1>
        <p className="text-sm text-slate-500">
          Send bulk SMS, manage automated notifications, and view message history.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('sms')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sms'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-ink hover:border-slate-300'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Send SMS
          </button>
          {canManageNotifications && (
            <>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'notifications'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-ink hover:border-slate-300'
                }`}
              >
                <Settings className="h-4 w-4" />
                Notification Settings
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-ink hover:border-slate-300'
                }`}
              >
                <History className="h-4 w-4" />
                Notification History
              </button>
            </>
          )}
        </nav>
      </div>

      {/* SMS Tab Content */}
      {activeTab === 'sms' && (
        <>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Sent</p>
              <p className="text-xl font-semibold text-ink">{totalSent}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Success Rate</p>
              <p className="text-xl font-semibold text-ink">{successRate}%</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Failed</p>
              <p className="text-xl font-semibold text-ink">{totalFailed}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-50">
              <Users className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active Members</p>
              <p className="text-xl font-semibold text-ink">
                {members.filter((m) => m.phone).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Send Bulk SMS Form */}
        <Card>
          <CardHeader title="Send Bulk SMS" action={<Send className="h-4 w-4 text-slate-400" />} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Message Input */}
            <div>
              <Textarea
                label="Message"
                rows={5}
                placeholder="Type your message here..."
                {...register('message')}
                error={errors.message?.message}
                maxLength={500}
              />
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {messageLength} characters ({smsCount} SMS)
                </span>
                {messageLength > 160 && (
                  <span className="text-amber-600">Message will be split into {smsCount} parts</span>
                )}
              </div>
            </div>

            {/* Recipient Type Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-ink">
                <Filter className="mb-1 inline h-4 w-4" /> Recipients
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setValue('recipientType', 'all');
                    setValue('ministryId', '');
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                    recipientType === 'all'
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Users className="h-5 w-5" />
                  <span className="text-xs font-medium">All Members</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('recipientType', 'ministry')}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                    recipientType === 'ministry'
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Filter className="h-5 w-5" />
                  <span className="text-xs font-medium">By Ministry</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setValue('recipientType', 'manual');
                    setValue('ministryId', '');
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-colors ${
                    recipientType === 'manual'
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-xs font-medium">Select</span>
                </button>
              </div>
            </div>

            {/* Ministry Selector */}
            {recipientType === 'ministry' && (
              <Select
                label="Select Ministry"
                {...register('ministryId')}
                options={ministries.map((m) => ({ value: m.id, label: m.name }))}
                placeholder="Choose a ministry"
              />
            )}

            {/* Manual Member Selection */}
            {recipientType === 'manual' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-ink">Select Members</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllMembers}
                      className="text-xs text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {membersLoading ? (
                    <p className="text-center text-sm text-slate-500">Loading members...</p>
                  ) : members.filter((m) => m.phone).length === 0 ? (
                    <p className="text-center text-sm text-slate-500">
                      No members with phone numbers found
                    </p>
                  ) : (
                    members
                      .filter((m) => m.phone)
                      .map((member) => (
                        <label
                          key={member.id}
                          className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={() => handleMemberToggle(member.id)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <div className="flex-1 text-sm">
                            <div className="font-medium text-ink">
                              {member.first_name} {member.last_name}
                            </div>
                            <div className="text-xs text-slate-500">{member.phone}</div>
                          </div>
                        </label>
                      ))
                  )}
                </div>
                {selectedMembers.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedMembers.length} member(s) selected
                  </p>
                )}
              </div>
            )}

            {/* Recipient Summary */}
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                <div className="text-sm text-slate-600">
                  <p className="font-medium">
                    Ready to send to {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                  </p>
                  <p className="mt-1 text-xs">
                    This will send approximately {recipientCount * smsCount} SMS message
                    {recipientCount * smsCount !== 1 ? 's' : ''}.
                    {recipientCount * smsCount > 100 && (
                      <span className="text-amber-600">
                        {' '}
                        This is a large batch - please confirm before sending.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              isLoading={isSending}
              disabled={recipientCount === 0 || !message.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4" />
              Send SMS to {recipientCount} Recipient{recipientCount !== 1 ? 's' : ''}
            </Button>
          </form>
        </Card>

        {/* Recurring Service Reminders */}
        <RecurringServiceReminders />
      </div>

      {/* SMS History */}
      <SmsLogsViewer />
        </>
      )}

      {/* Notification Settings Tab Content */}
      {activeTab === 'notifications' && canManageNotifications && (
        <>
          {workflowsQuery.isLoading ? (
            <Spinner />
          ) : (
            <>
              {/* Action Buttons */}
              <Card className="bg-blue-50 border-blue-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Automated Notifications</p>
                      <p className="text-xs text-blue-700 mt-1">
                        These workflows run automatically in the background. Toggle workflows on/off and customize message templates.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testWorkflowMutation.mutate()}
                      isLoading={testWorkflowMutation.isPending}
                    >
                      <Play className="h-4 w-4" />
                      Check Now
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => processMutation.mutate()}
                      isLoading={processMutation.isPending}
                    >
                      <Clock className="h-4 w-4" />
                      Process Queue
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Workflows List */}
              <div className="space-y-4">
                {workflows.map((workflow) => (
                  <Card key={workflow.id}>
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-ink">{workflow.name}</h3>
                            <Badge tone={workflow.is_active ? 'green' : 'slate'}>
                              {workflow.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{workflow.description}</p>
                          {workflow.last_run_at && (
                            <p className="text-xs text-slate-400 mt-1">
                              Last run: {new Date(workflow.last_run_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={workflow.is_active ? 'outline' : 'primary'}
                          onClick={() => handleToggleWorkflow(workflow)}
                          isLoading={
                            updateWorkflowMutation.isPending &&
                            updateWorkflowMutation.variables?.id === workflow.id
                          }
                        >
                          {workflow.is_active ? (
                            <>
                              <BellOff className="h-4 w-4" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Bell className="h-4 w-4" />
                              Enable
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Message Template */}
                      <div className="pt-3 border-t">
                        <label className="text-sm font-medium text-ink block mb-2">
                          Message Template
                        </label>
                        {editingWorkflowId === workflow.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editMessage}
                              onChange={(e) => setEditMessage(e.target.value)}
                              rows={3}
                              placeholder="Enter message template..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveMessage(workflow)}
                                isLoading={
                                  updateWorkflowMutation.isPending &&
                                  updateWorkflowMutation.variables?.id === workflow.id
                                }
                              >
                                <Save className="h-4 w-4" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingWorkflowId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100"
                            onClick={() => startEditingWorkflow(workflow)}
                          >
                            <p className="text-sm text-slate-700">{workflow.message_template}</p>
                            <p className="text-xs text-slate-500 mt-2">Click to edit</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Placeholders Guide */}
              <Card className="bg-slate-50">
                <h3 className="text-sm font-semibold text-ink mb-3">Available Placeholders</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <code className="bg-white px-2 py-1 rounded border">{'{first_name}'}</code>
                  <code className="bg-white px-2 py-1 rounded border">{'{last_name}'}</code>
                  <code className="bg-white px-2 py-1 rounded border">{'{full_name}'}</code>
                  <code className="bg-white px-2 py-1 rounded border">{'{event_title}'}</code>
                  <code className="bg-white px-2 py-1 rounded border">{'{event_date}'}</code>
                  <code className="bg-white px-2 py-1 rounded border">{'{event_time}'}</code>
                  <code className="bg-white px-2 py-1 rounded border">{'{event_location}'}</code>
                  <code className="bg-white px-2 py-1 rounded border">{'{days_inactive}'}</code>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* Notification History Tab Content */}
      {activeTab === 'history' && canManageNotifications && (
        <>
          {/* Header with Reset Button */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">Notification History</h3>
                <p className="text-sm text-slate-500 mt-1">
                  View and manage automated notification logs
                </p>
              </div>
              <Button
                onClick={handleResetHistory}
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={resetHistoryMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {resetHistoryMutation.isPending ? 'Clearing...' : 'Clear History'}
              </Button>
            </div>
          </Card>

          {queueQuery.isLoading || statsQuery.isLoading ? (
            <Spinner />
          ) : queueQuery.isError ? (
            <Card>
              <EmptyState
                icon={AlertCircle}
                title="Error Loading Notification History"
                description={`Failed to load notification data: ${(queueQuery.error as Error)?.message || 'Unknown error'}`}
              />
            </Card>
          ) : (
            <>
              {/* Stats Cards */}
              {notificationStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Bell className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Total Sent</p>
                        <p className="text-2xl font-bold text-ink">{notificationStats.total_sent}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">Successful</p>
                        <p className="text-2xl font-bold text-green-600">{notificationStats.successful}</p>
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
                        <p className="text-2xl font-bold text-red-600">{notificationStats.failed}</p>
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
                        <p className="text-2xl font-bold text-amber-600">{notificationStats.pending}</p>
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
                {notificationLogs.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No execution logs yet"
                    description="Workflow execution history will appear here"
                  />
                ) : (
                  <div className="space-y-2">
                    {notificationLogs.map((log) => (
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
            </>
          )}
        </>
      )}
    </div>
  );
}
