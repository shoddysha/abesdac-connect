import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Calendar, User, Search, Trash2, Download, Filter, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchAuditLogs } from '@/services/audit';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { exportToCSV } from '@/utils/export';
import toast from 'react-hot-toast';
import type { AuditLog } from '@/types/database';
import { useState, useMemo } from 'react';

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

const actionColors: Record<string, 'green' | 'blue' | 'red' | 'orange' | 'slate'> = {
  INSERT: 'green',
  UPDATE: 'blue', 
  DELETE: 'red',
  SUCCESS: 'green',
  ERROR: 'red',
  WARNING: 'orange',
};

const statusLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUCCESS: { label: 'Success', icon: CheckCircle },
  ERROR: { label: 'Error', icon: XCircle },
  WARNING: { label: 'Warning', icon: AlertTriangle },
};

export function AuditLogs() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState(false);

  const logsQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => fetchAuditLogs(1000), // Increased to 1000 for better stats
  });

  useRealtimeQuery('audit_logs', ['audit-logs']);

  const logs = logsQuery.data ?? [];

  // Calculate stats
  const stats = useMemo(() => {
    const totalEvents = logs.length;
    const successful = logs.filter(log => 
      log.action?.toUpperCase() === 'SUCCESS' || 
      (!log.action?.toUpperCase().includes('ERROR') && !log.action?.toUpperCase().includes('FAIL'))
    ).length;
    const errors = logs.filter(log => 
      log.action?.toUpperCase().includes('ERROR') || 
      log.action?.toUpperCase().includes('FAIL') ||
      log.description?.toLowerCase().includes('error') ||
      log.description?.toLowerCase().includes('failed')
    ).length;
    const warnings = logs.filter(log => 
      log.action?.toUpperCase().includes('WARNING') ||
      log.description?.toLowerCase().includes('warning')
    ).length;
    
    return { totalEvents, successful, errors, warnings };
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.module?.toLowerCase().includes(searchLower) ||
      log.action?.toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower);
    
    const matchesModule = !moduleFilter || log.module === moduleFilter;
    const matchesStatus = !statusFilter || log.action?.toUpperCase().includes(statusFilter);
    
    return matchesSearch && matchesModule && matchesStatus;
  });

  // Get unique modules for filter
  const moduleOptions = useMemo(() => {
    const modules = [...new Set(logs.map(log => log.module).filter(Boolean))];
    return modules.map(module => ({
      value: module,
      label: moduleLabels[module] || module
    }));
  }, [logs]);

  function exportLogs() {
    const exportData = filteredLogs.map(log => ({
      'Date & Time': new Date(log.created_at).toLocaleString(),
      'User': log.user_name || 'System',
      'Action': log.action || '',
      'Module': moduleLabels[log.module] || log.module || '',
      'Status': log.action?.toUpperCase().includes('ERROR') ? 'Error' : 
               log.action?.toUpperCase().includes('WARNING') ? 'Warning' : 'Success',
      'Description': log.description || '',
    }));
    exportToCSV('audit-logs', exportData);
    toast.success('Audit logs exported successfully');
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Security monitoring and activity tracking</p>
        </div>
        <Button variant="outline" onClick={exportLogs} disabled={filteredLogs.length === 0}>
          <Download className="h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalEvents}</div>
          <div className="text-sm text-slate-500">Total Events</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{stats.successful}</div>
          <div className="text-sm text-slate-500">Successful</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-red-600 mb-2">{stats.errors}</div>
          <div className="text-sm text-slate-500">Errors / Alerts</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-orange-600 mb-2">{stats.warnings}</div>
          <div className="text-sm text-slate-500">Warnings</div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          options={[
            { value: '', label: 'All' },
            ...moduleOptions
          ]}
          className="w-full sm:w-48"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All Status' },
            { value: 'SUCCESS', label: 'Success' },
            { value: 'ERROR', label: 'Error' },
            { value: 'WARNING', label: 'Warning' },
          ]}
          className="w-full sm:w-48"
        />
      </div>

      {/* Audit Logs Table */}
      {logsQuery.isLoading ? (
        <Spinner />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={search || moduleFilter || statusFilter ? 'No matching logs' : 'No audit logs yet'}
          description={
            search || moduleFilter || statusFilter
              ? 'Try adjusting your search or filters'
              : 'System activity will be recorded here'
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 text-xs uppercase tracking-wide">
                  <th className="pb-3 px-4 font-medium">User</th>
                  <th className="pb-3 px-4 font-medium">Action</th>
                  <th className="pb-3 px-4 font-medium">Module</th>
                  <th className="pb-3 px-4 font-medium">Date & Time</th>
                  <th className="pb-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs.map((log) => {
                  const isError = log.action?.toUpperCase().includes('ERROR') || 
                                  log.description?.toLowerCase().includes('error');
                  const isWarning = log.action?.toUpperCase().includes('WARNING') || 
                                   log.description?.toLowerCase().includes('warning');
                  
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{log.user_name || 'System'}</div>
                            <div className="text-xs text-slate-500">192.168.1.45</div> {/* Mock IP */}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{log.description || log.action}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {moduleLabels[log.module] || log.module}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(log.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric'
                        })} • {new Date(log.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isError ? 'bg-red-100 text-red-700' : 
                            isWarning ? 'bg-orange-100 text-orange-700' : 
                            'bg-green-100 text-green-700'
                          }`}>
                            {isError ? 'Error' : isWarning ? 'Warning' : 'Success'}
                          </span>
                          <button className="ml-2 p-1 hover:bg-slate-100 rounded">
                            <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between text-sm text-slate-500">
            <span>Showing {filteredLogs.length} of {logs.length} log entries</span>
            {hasRole('administrator') && logs.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDeleteAll} isLoading={deleting}>
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
