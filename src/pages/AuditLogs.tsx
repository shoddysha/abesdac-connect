import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Calendar, User, Search, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchAuditLogs } from '@/services/audit';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { AuditLog } from '@/types/database';
import { useState } from 'react';

const moduleLabels: Record<string, string> = {
  members: 'Members',
  ministries: 'Ministries',
  ministry_leaders: 'Ministry Leaders',
  events: 'Events',
  attendance: 'Attendance',
  announcements: 'Announcements',
  visitors: 'Visitors',
  prayer_requests: 'Prayer Requests',
  users: 'Users',
  profiles: 'User Profiles',
  sms_logs: 'SMS',
};

const actionColors: Record<string, 'green' | 'blue' | 'red' | 'slate'> = {
  INSERT: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
};

export function AuditLogs() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(false);

  const logsQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => fetchAuditLogs(500),
  });

  useRealtimeQuery('audit_logs', ['audit-logs']);

  const logs = logsQuery.data ?? [];

  const filteredLogs = logs.filter((log) => {
    const searchLower = search.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.module?.toLowerCase().includes(searchLower) ||
      log.action?.toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower)
    );
  });

  async function handleDeleteAll() {
    if (!confirm('Are you sure you want to delete ALL audit logs? This action cannot be undone!')) {
      return;
    }

    setDeleting(true);
    try {
      // Delete all records by using gt('id', '') which matches all non-null IDs
      const { error } = await supabase.from('audit_logs').delete().not('id', 'is', null);
      
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('All audit logs deleted');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          <Shield className="h-6 w-6 text-secondary" />
          Audit Logs
        </h1>
        <p className="text-sm text-slate-500">
          Complete history of all system changes and actions
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <Card>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search logs by user, module, action, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>
        </div>
        {hasRole('administrator') && logs.length > 0 && (
          <Button variant="outline" onClick={handleDeleteAll} isLoading={deleting}>
            <Trash2 className="h-4 w-4" /> Delete All
          </Button>
        )}
      </div>

      {logsQuery.isLoading ? (
        <Spinner />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={search ? 'No matching logs' : 'No audit logs yet'}
          description={
            search
              ? 'Try adjusting your search terms'
              : 'System activity will be recorded here'
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="pb-3 font-semibold text-slate-600">Timestamp</th>
                  <th className="pb-3 font-semibold text-slate-600">User</th>
                  <th className="pb-3 font-semibold text-slate-600">Module</th>
                  <th className="pb-3 font-semibold text-slate-600">Action</th>
                  <th className="pb-3 font-semibold text-slate-600">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>
                          {new Date(log.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-700">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{log.user_name || 'System'}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge tone="slate">
                        {moduleLabels[log.module] || log.module}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge tone={actionColors[log.action] || 'slate'}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-600">
                      {log.description || <span className="italic text-slate-400">No description</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
            Showing {filteredLogs.length} of {logs.length} log entries
          </div>
        </Card>
      )}
    </div>
  );
}
