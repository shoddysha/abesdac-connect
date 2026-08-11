import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Calendar,
  TrendingUp,
  Users as UsersIcon,
  DollarSign,
  Download,
  Filter,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Input';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { fetchAllMinistryReports } from '@/services/ministryReports';
import { fetchMinistries } from '@/services/ministries';
import { useState } from 'react';

export function AllMinistryReports() {
  const navigate = useNavigate();
  const [selectedMinistry, setSelectedMinistry] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const reportsQuery = useQuery({
    queryKey: ['all-ministry-reports'],
    queryFn: fetchAllMinistryReports,
  });

  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  useRealtimeQuery('ministry_reports', ['all-ministry-reports']);

  const reports = reportsQuery.data ?? [];
  const ministries = ministriesQuery.data ?? [];

  // Filter reports
  const filteredReports = reports.filter((report) => {
    if (selectedMinistry !== 'all' && report.ministry_id !== selectedMinistry) return false;
    if (selectedType !== 'all' && report.report_type !== selectedType) return false;
    return true;
  });

  // Group by ministry
  const reportsByMinistry = filteredReports.reduce((acc, report) => {
    if (!acc[report.ministry_id]) {
      acc[report.ministry_id] = {
        ministry_name: report.ministry_name || 'Unknown',
        reports: [],
      };
    }
    acc[report.ministry_id].reports.push(report);
    return acc;
  }, {} as Record<string, { ministry_name: string; reports: typeof reports }>);

  async function handleExport() {
    // Export all reports to CSV
    const headers = [
      'Ministry',
      'Report Period',
      'Report Type',
      'Title',
      'Summary',
      'Achievements',
      'Challenges',
      'Attendance',
      'Expenses',
      'Future Plans',
      'Submitted By',
      'Submitted At',
    ];

    const rows = filteredReports.map((r) => [
      r.ministry_name || '',
      r.report_period,
      r.report_type,
      r.title,
      r.summary || '',
      r.achievements || '',
      r.challenges || '',
      r.attendance_count?.toString() || '',
      r.expenses?.toString() || '',
      r.future_plans || '',
      r.submitter_name || '',
      new Date(r.submitted_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ministry-reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministry Reports</h1>
          <p className="text-sm text-slate-500">
            View all submitted reports from ministry leaders
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filteredReports.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              options={[
                { value: 'all', label: 'All Ministries' },
                ...ministries.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'annual', label: 'Annual' },
                { value: 'special', label: 'Special' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total Reports</p>
          <p className="text-2xl font-bold text-ink">{filteredReports.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">This Month</p>
          <p className="text-2xl font-bold text-secondary">
            {
              filteredReports.filter(
                (r) =>
                  new Date(r.submitted_at).getMonth() === new Date().getMonth() &&
                  new Date(r.submitted_at).getFullYear() === new Date().getFullYear()
              ).length
            }
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Ministries Reporting</p>
          <p className="text-2xl font-bold text-accent">
            {Object.keys(reportsByMinistry).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total Expenses</p>
          <p className="text-2xl font-bold text-ink">
            GH₵
            {filteredReports
              .reduce((sum, r) => sum + (r.expenses || 0), 0)
              .toFixed(2)}
          </p>
        </Card>
      </div>

      {/* Reports by Ministry */}
      {reportsQuery.isLoading ? (
        <Spinner />
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports found"
          description="No ministry reports match your filters"
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(reportsByMinistry).map(([ministryId, group]) => (
            <div key={ministryId}>
              <h2 className="text-lg font-semibold text-ink mb-3 flex items-center gap-2">
                {group.ministry_name}
                <Badge tone="slate">{group.reports.length} reports</Badge>
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                {group.reports.map((report) => (
                  <Card key={report.id}>
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
                    </div>

                    {report.summary && (
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {report.summary}
                      </p>
                    )}

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-slate-50 rounded-lg">
                      {report.attendance_count !== null && (
                        <div className="flex items-center gap-2">
                          <UsersIcon className="h-4 w-4 text-secondary" />
                          <div>
                            <p className="text-xs text-slate-500">Attendance</p>
                            <p className="font-semibold text-ink">
                              {report.attendance_count}
                            </p>
                          </div>
                        </div>
                      )}
                      {report.expenses !== null && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-accent" />
                          <div>
                            <p className="text-xs text-slate-500">Expenses</p>
                            <p className="font-semibold text-ink">
                              GH₵{report.expenses.toFixed(2)}
                            </p>
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
                            <p className="text-xs font-semibold text-slate-700 mb-1">
                              Challenges
                            </p>
                            <p className="text-sm text-slate-600">{report.challenges}</p>
                          </div>
                        )}
                        {report.future_plans && (
                          <div>
                            <p className="text-xs font-semibold text-slate-700 mb-1">
                              Future Plans
                            </p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
