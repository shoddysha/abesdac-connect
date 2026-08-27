import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bell, BellOff, Save, Play, Clock, Settings as SettingsIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Input, Textarea } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotificationWorkflows,
  updateNotificationWorkflow,
  checkAllWorkflows,
  processPendingNotifications,
} from '@/services/notifications';
import type { NotificationWorkflow } from '@/types/notifications';

export function NotificationSettings() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');

  const canManage = hasRole('administrator', 'secretary');

  const workflowsQuery = useQuery({
    queryKey: ['notification-workflows'],
    queryFn: fetchNotificationWorkflows,
    enabled: canManage,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<NotificationWorkflow> }) =>
      updateNotificationWorkflow(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-workflows'] });
      toast.success('Workflow updated successfully');
      setEditingId(null);
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
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleToggle(workflow: NotificationWorkflow) {
    updateMutation.mutate({
      id: workflow.id,
      updates: { is_active: !workflow.is_active },
    });
  }

  function handleSaveMessage(workflow: NotificationWorkflow) {
    updateMutation.mutate({
      id: workflow.id,
      updates: { message_template: editMessage },
    });
  }

  function startEditing(workflow: NotificationWorkflow) {
    setEditingId(workflow.id);
    setEditMessage(workflow.message_template);
  }

  const workflows = workflowsQuery.data || [];

  if (!canManage) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Notification Settings</h1>
        <EmptyState
          icon={Bell}
          title="Access Denied"
          description="Only administrators and secretaries can manage notifications"
        />
      </div>
    );
  }

  if (workflowsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Notification Settings</h1>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Notification Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage automated notification workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => testWorkflowMutation.mutate()}
            isLoading={testWorkflowMutation.isPending}
          >
            <Play className="h-4 w-4" />
            Check Now
          </Button>
          <Button
            onClick={() => processMutation.mutate()}
            isLoading={processMutation.isPending}
          >
            <Clock className="h-4 w-4" />
            Process Queue
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <SettingsIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              Automated Notifications
            </p>
            <p className="text-xs text-blue-700 mt-1">
              These workflows run automatically in the background. Toggle workflows on/off and customize
              message templates. Use placeholders like {'{first_name}'}, {'{event_title}'}, etc.
            </p>
          </div>
        </div>
      </Card>

      {/* Workflows */}
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
                  onClick={() => handleToggle(workflow)}
                  isLoading={
                    updateMutation.isPending &&
                    updateMutation.variables?.id === workflow.id
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
                {editingId === workflow.id ? (
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
                          updateMutation.isPending &&
                          updateMutation.variables?.id === workflow.id
                        }
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100"
                    onClick={() => startEditing(workflow)}
                  >
                    <p className="text-sm text-slate-700">{workflow.message_template}</p>
                    <p className="text-xs text-slate-500 mt-2">Click to edit</p>
                  </div>
                )}
              </div>

              {/* Schedule Info */}
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-slate-500 mb-1">Schedule Configuration</p>
                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded font-mono">
                  {JSON.stringify(workflow.schedule_config, null, 2)}
                </div>
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
    </div>
  );
}
