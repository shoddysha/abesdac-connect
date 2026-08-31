import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Trash2,
  FileText,
  Calendar,
  TrendingUp,
  Users as UsersIcon,
  DollarSign,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { DeadlineNotificationsButton } from '@/components/DeadlineNotificationsButton';
import { DeadlineNotificationsModal } from '@/components/DeadlineNotificationsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchMinistries } from '@/services/ministries';
import { supabase } from '@/lib/supabase';
import {
  deleteMinistryReport,
  type MinistryReportWithDetails,
} from '@/services/ministryReports';
import { format } from 'date-fns';

export function MinistryReports() {
  const { profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);

  const canEdit = hasRole('ministry_leader'); // Only ministry leaders can edit

  // Fetch user's ministry (for cases where properly assigned)
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);

  // NEW: Fetch reports that this user submitted (works even without ministry assignment)
  const reportsQuery = useQuery({
    queryKey: ['ministry-leader-reports', profile?.id],
    queryFn: async () => {
      if (!profile?.id) {
        console.log('❌ No profile ID found');
        return [];
      }
      
      console.log('🔍 Fetching reports for user:', profile.id);
      console.log('🔍 User role:', profile.role);
      console.log('🔍 Has ministry_leader role:', hasRole('ministry_leader'));
      
      const { data, error } = await supabase
        .from('ministry_reports')
        .select(`
          *,
          ministries(name),
          submitter:profiles!ministry_reports_submitted_by_fkey(full_name)
        `)
        .eq('submitted_by', profile.id)
        .order('submitted_at', { ascending: false});

      if (error) {
        console.error('❌ Error fetching reports:', error);
        throw error;
      }

      console.log('✅ Raw data from database:', data);
      console.log('📊 Number of reports found:', data?.length || 0);

      const mapped = (data || []).map((report: any) => ({
        ...report,
        ministry_name: report.ministries?.name,
        submitter_name: report.submitter?.full_name,
      }));
      
      console.log('✅ Mapped reports:', mapped);

      return mapped;
    },
    enabled: !!profile?.id,  // CHANGED: Removed hasRole check to test
  });

  useRealtimeQuery('ministry_reports', ['ministry-leader-reports', profile?.id]);

  const reports = reportsQuery.data ?? [];
  
  console.log('📋 Final reports array:', reports);
  console.log('📋 Reports length:', reports.length);
  console.log('🔐 User profile ID:', profile?.id);
  console.log('🏢 User ministry:', userMinistry);
  console.log('✅ Can edit:', canEdit);
  console.log('⏳ Query loading:', reportsQuery.isLoading);
  console.log('❌ Query error:', reportsQuery.error);

  async function handleDeleteReport(report: MinistryReportWithDetails) {
    if (!canEdit) return;
    if (!confirm(`Delete report "${report.title}"?`)) return;

    try {
      await deleteMinistryReport(report.id);
      queryClient.invalidateQueries({ queryKey: ['ministry-leader-reports'] });
      toast.success('Report deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Show loading state
  if (reportsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
        <Spinner />
      </div>
    );
  }

  // Show empty state only if the user has no reports and no ministry assignment
  if (!userMinistry && reports.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
        <EmptyState
          icon={FileText}
          title="No ministry assigned"
          description="Contact an administrator to assign you as a ministry leader"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ministry-dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
            <p className="text-sm text-slate-500">
              {userMinistry?.name || (reports.length > 0 ? reports[0].ministry_name : 'My Reports')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <DeadlineNotificationsButton onClick={() => setDeadlineModalOpen(true)} />
          {canEdit && (
            <Button onClick={() => navigate('/submit-ministry-report')}>
              <Plus className="h-4 w-4" /> Submit Report
            </Button>
          )}
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description={canEdit ? "Submit your first ministry report" : "No reports have been submitted yet"}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report) => (
            <Card key={report.id}>
              {/* Acknowledgement banner */}
              {report.acknowledged_at && (
                <div className="mb-3 p-2 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-800">Acknowledged by Church Leadership</p>
                    <p className="text-xs text-green-700">
                      {format(new Date(report.acknowledged_at), 'MMM d, yyyy')}
                    </p>
                    {report.acknowledgement_note && (
                      <p className="text-xs text-green-600 mt-1">{report.acknowledgement_note}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-ink">{report.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge tone="blue">{report.report_type}</Badge>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {report.report_period}
                    </span>
                  </div>
                </div>
                {canEdit && report.acknowledged_at && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report)} title="Delete acknowledged report">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {canEdit && !report.acknowledged_at && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {report.summary && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{report.summary}</p>
              )}

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-slate-50 rounded-lg">
                {report.attendance_count !== null && (
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-secondary" />
                    <div>
                      <p className="text-xs text-slate-500">Attendance</p>
                      <p className="font-semibold text-ink">{report.attendance_count}</p>
                    </div>
                  </div>
                )}
                {report.expenses !== null && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-accent" />
                    <div>
                      <p className="text-xs text-slate-500">Expenses</p>
                      <p className="font-semibold text-ink">GH₵{report.expenses.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Expandable Sections */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-secondary hover:text-secondary/80 mb-2">
                  View Details
                </summary>
                <div className="space-y-3 pl-2 border-l-2 border-slate-200">
                  {report.achievements && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        Achievements
                      </p>
                      <p className="text-sm text-slate-600">{report.achievements}</p>
                    </div>
                  )}
                  {report.challenges && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">Challenges</p>
                      <p className="text-sm text-slate-600">{report.challenges}</p>
                    </div>
                  )}
                  {report.future_plans && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">Future Plans</p>
                      <p className="text-sm text-slate-600">{report.future_plans}</p>
                    </div>
                  )}
                </div>
              </details>

              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                Submitted: {new Date(report.submitted_at).toLocaleDateString()} by{' '}
                {report.submitter_name || 'Unknown'}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Deadline Notifications Modal */}
      <DeadlineNotificationsModal 
        open={deadlineModalOpen}
        onClose={() => setDeadlineModalOpen(false)}
        onNavigateToSubmit={() => {
          setDeadlineModalOpen(false);
          navigate('/submit-ministry-report');
        }}
      />
    </div>
  );
}
