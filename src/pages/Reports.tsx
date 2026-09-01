import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { 
  Download, 
  Users, 
  UserPlus, 
  TrendingUp, 
  TrendingDown,
  Activity,
  DollarSign,
  Calendar,
  Filter,
  FileText,
  BarChart3,
  ArrowUp,
  ArrowDown
} from 'lucide-react';, Eye, CheckCircle, Clock, Heart
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  AreaChart,
  Area,
  Legend,
  ComposedChart
} from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { Select } from '@/components/ui/Input';
import { fetchMembers } from '@/services/members';
import {
  getMembershipGrowth,
  getAttendancePatterns,
  getAverageAttendanceByType,
  getVisitorConversionFunnel,
  getDemographics,
  getMinistryMetrics,
  getFinancialTrends,
  getEngagementMetrics,
  getRetentionMetrics,
  getComparisonData,
} from '@/services/analytics';
  getAnnouncementMetrics,
  getDeadlineMetrics,
  getFollowUpMetrics,
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/export';

const COLORS = ['#0F2A5F', '#1E5EFF', '#D4A76A', '#64748B', '#22C55E', '#EF4444', '#8B5CF6', '#F59E0B'];

type DateRange = '30days' | '3months' | '6months' | '1year' | 'ytd';

export function Reports() {
  const [dateRange, setDateRange] = useState<DateRange>('3months');
  
  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    let start: Date;
    
    switch (dateRange) {
      case '30days':
        start = subDays(end, 30);
        break;
      case '3months':
        start = subMonths(end, 3);
        break;
      case '6months':
        start = subMonths(end, 6);
        break;
      case '1year':
        start = subMonths(end, 12);
        break;
      case 'ytd':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      default:
        start = subMonths(end, 3);
    }
    
    return { startDate: start, endDate: end };
  }, [dateRange]);

  // Fetch all analytics data
  const membersQuery = useQuery({ 
    queryKey: ['members-report'], 
    queryFn: () => fetchMembers({}) 
  });

  const membershipGrowthQuery = useQuery({
    queryKey: ['membership-growth', dateRange],
    queryFn: () => getMembershipGrowth(dateRange === '1year' ? 12 : dateRange === '6months' ? 6 : 3),
  });

  const attendancePatternsQuery = useQuery({
    queryKey: ['attendance-patterns', dateRange],
    queryFn: () => getAttendancePatterns(startDate, endDate),
  });

  const avgAttendanceQuery = useQuery({
    queryKey: ['avg-attendance', dateRange],
    queryFn: () => getAverageAttendanceByType(3),
  });

  const visitorFunnelQuery = useQuery({
    queryKey: ['visitor-funnel'],
    queryFn: getVisitorConversionFunnel,
  });

  const demographicsQuery = useQuery({
    queryKey: ['demographics'],
    queryFn: getDemographics,
  });

  const ministryMetricsQuery = useQuery({
    queryKey: ['ministry-metrics'],
    queryFn: getMinistryMetrics,
  });

  const financialTrendsQuery = useQuery({
    queryKey: ['financial-trends', dateRange],
    queryFn: () => getFinancialTrends(12),
  });

  const engagementQuery = useQuery({
    queryKey: ['engagement'],
    queryFn: getEngagementMetrics,
  });

  const retentionQuery = useQuery({
    queryKey: ['retention'],
    queryFn: getRetentionMetrics,
  });

  const comparisonQuery = useQuery({
    queryKey: ['comparison', dateRange],
    queryFn: () => getComparisonData(startDate, endDate),
  });
  // New feature metrics
  const announcementMetricsQuery = useQuery({
    queryKey: ['announcement-metrics', dateRange],
    queryFn: () => getAnnouncementMetrics(startDate, endDate),
  });

  const deadlineMetricsQuery = useQuery({
    queryKey: ['deadline-metrics', dateRange],
    queryFn: () => getDeadlineMetrics(startDate, endDate),
  });

  const followUpMetricsQuery = useQuery({
    queryKey: ['followup-metrics', dateRange],
    queryFn: () => getFollowUpMetrics(startDate, endDate),
  });

  // Real-time subscriptions for dynamic data
  useRealtimeQuery('ministry_budgets', ['financial-trends', dateRange]);
  useRealtimeQuery('ministry_reports', ['ministry-metrics']);
  useRealtimeQuery('announcements', ['announcement-metrics', dateRange]);
  useRealtimeQuery('report_deadlines', ['deadline-metrics', dateRange]);
  useRealtimeQuery('member_follow_ups', ['followup-metrics', dateRange]);

  const members = membersQuery.data ?? [];
  const membershipGrowth = membershipGrowthQuery.data ?? [];
  const attendancePatterns = attendancePatternsQuery.data ?? [];
  const avgAttendance = avgAttendanceQuery.data ?? [];
  const visitorFunnel = visitorFunnelQuery.data ?? [];
  const demographics = demographicsQuery.data;
  const ministryMetrics = ministryMetricsQuery.data ?? [];
  const financialTrends = financialTrendsQuery.data ?? [];
  const engagement = engagementQuery.data;
  const retention = retentionQuery.data;
  const comparison = comparisonQuery.data;
  const announcementMetrics = announcementMetricsQuery.data;
  const deadlineMetrics = deadlineMetricsQuery.data;
  const followUpMetrics = followUpMetricsQuery.data;

  const isLoading = membersQuery.isLoading || 
    membershipGrowthQuery.isLoading || 
    attendancePatternsQuery.isLoading;

  // Export function
  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    const data = members.map((m) => ({
      'Member ID': m.member_code,
      Name: `${m.first_name} ${m.last_name}`,
      Gender: m.gender || '',
      Status: m.status,
      District: m.district || '',
      Ministry: m.ministries?.name || '',
      'Date Joined': m.date_joined,
    }));

    if (type === 'csv') {
      exportToCSV('church-analytics-report', data);
    } else if (type === 'excel') {
      exportToExcel('church-analytics-report', data);
    } else {
      exportToPDF(
        'Church Analytics Report — Abeka SDA Church',
        'analytics-report',
        ['Member ID', 'Name', 'Gender', 'Status', 'District', 'Ministry'],
        members.map((m) => [
          m.member_code,
          `${m.first_name} ${m.last_name}`,
          m.gender || '',
          m.status,
          m.district || '',
          m.ministries?.name || ''
        ])
      );
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Advanced Analytics & Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive insights for data-driven decision making
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            options={[
              { value: '30days', label: 'Last 30 Days' },
              { value: '3months', label: 'Last 3 Months' },
              { value: '6months', label: 'Last 6 Months' },
              { value: '1year', label: 'Last Year' },
              { value: 'ytd', label: 'Year to Date' },
            ]}
          />
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics with Comparison */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* First Row - Existing Metrics */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Members</p>
              <p className="text-2xl font-bold text-ink">{members.length}</p>
              {retention && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  +{retention.newMembers} this year
                </p>
              )}
            </div>
            <div className="p-3 bg-primary-50 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Engagement Rate</p>
              <p className="text-2xl font-bold text-ink">{engagement?.engagementRate || 0}%</p>
              {engagement && (
                <p className="text-xs text-slate-500 mt-1">
                  {engagement.activeMembers} active last 30 days
                </p>
              )}
            </div>
            <div className="p-3 bg-secondary-50 rounded-lg">
              <Activity className="h-6 w-6 text-secondary" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Attendance</p>
              <p className="text-2xl font-bold text-ink">{comparison?.attendance.current || 0}</p>
              {comparison && comparison.attendance.change !== 0 && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  comparison.attendance.change > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {comparison.attendance.change > 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs(comparison.attendance.change)}% vs last period
                </p>
              )}
            </div>
            <div className="p-3 bg-accent-50 rounded-lg">
              <Calendar className="h-6 w-6 text-accent" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">New Visitors</p>
              <p className="text-2xl font-bold text-ink">{comparison?.visitors.current || 0}</p>
              {comparison && comparison.visitors.change !== 0 && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  comparison.visitors.change > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {comparison.visitors.change > 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs(comparison.visitors.change)}% vs last period
                </p>
              )}
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

     
      {/* Second Row - New Feature Metrics */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Announcement Views</p>
            <p className="text-2xl font-bold text-ink">{announcementMetrics?.totalViews || 0}</p>
            <p className="text-xs text-slate-500 mt-1">
              {announcementMetrics?.totalAnnouncements || 0} announcements
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <Eye className="h-6 w-6 text-purple-600" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Report Deadlines</p>
            <p className="text-2xl font-bold text-ink">{deadlineMetrics?.completionRate || 0}%</p>
            <p className="text-xs text-slate-500 mt-1">
              {deadlineMetrics?.completed || 0}/{deadlineMetrics?.total || 0} completed
            </p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Follow-ups</p>
            <p className="text-2xl font-bold text-ink">{followUpMetrics?.pending || 0}</p>
            <p className="text-xs text-slate-500 mt-1">
              {followUpMetrics?.completionRate || 0}% completion rate
            </p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <Heart className="h-6 w-6 text-amber-600" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Avg Follow-up Time</p>
            <p className="text-2xl font-bold text-ink">{followUpMetrics?.avgDuration || 0}</p>
            <p className="text-xs text-slate-500 mt-1">
              days to complete
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </Card>
 {/* Membership Growth Trends */}
      <Card>
        <CardHeader title="Membership Growth Trends" icon={TrendingUp} />
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={membershipGrowth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="total"
              fill="#1E5EFF"
              stroke="#1E5EFF"
              fillOpacity={0.3}
              name="Total Members"
            />
            <Bar yAxisId="right" dataKey="joined" fill="#22C55E" name="New Members" radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Attendance Patterns */}
      <Card>
        <CardHeader title="Attendance Patterns by Service Type" icon={Calendar} />
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={attendancePatterns}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }} 
              interval={Math.max(Math.floor(attendancePatterns.length / 8), 0)}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="sabbath"
              stackId="1"
              stroke="#0F2A5F"
              fill="#0F2A5F"
              name="Sabbath Service"
            />
            <Area
              type="monotone"
              dataKey="midweek"
              stackId="1"
              stroke="#1E5EFF"
              fill="#1E5EFF"
              name="Midweek Service"
            />
            <Area
              type="monotone"
              dataKey="event"
              stackId="1"
              stroke="#D4A76A"
              fill="#D4A76A"
              name="Events"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Two-column grid for smaller charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visitor Conversion Funnel */}
        <Card>
          <CardHeader title="Visitor Conversion Funnel" icon={UserPlus} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={visitorFunnel} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#22C55E" radius={[0, 4, 4, 0]}>
                {visitorFunnel.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Average Attendance by Type */}
        <Card>
          <CardHeader title="Average Attendance by Type" icon={BarChart3} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={avgAttendance}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="average" fill="#1E5EFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Gender Distribution */}
        {demographics && (
          <Card>
            <CardHeader title="Gender Distribution" icon={Users} />
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie 
                  data={demographics.gender} 
                  dataKey="value" 
                  nameKey="name" 
                  innerRadius={60} 
                  outerRadius={100} 
                  paddingAngle={2}
                  label
                >
                  {demographics.gender.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Age Distribution */}
        {demographics && (
          <Card>
            <CardHeader title="Age Distribution" icon={Users} />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={demographics.ageGroups}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0F2A5F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Financial Trends */}
        <Card className="lg:col-span-2">
          <CardHeader title="Financial Trends (Ministry Budgets & Expenses)" icon={DollarSign} />
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={financialTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `GH₵${Number(value).toLocaleString()}`} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="expenses" 
                stroke="#EF4444" 
                strokeWidth={2} 
                name="Expenses" 
              />
              <Line 
                type="monotone" 
                dataKey="budgetRequested" 
                stroke="#F59E0B" 
                strokeWidth={2} 
                name="Budget Requested" 
              />
              <Line 
                type="monotone" 
                dataKey="budgetApproved" 
                stroke="#22C55E" 
                strokeWidth={2} 
                name="Budget Approved" 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>
      {/* New Feature Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Announcement Engagement */}
        <Card>
          <CardHeader title="Announcement Engagement" icon={Eye} />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={announcementMetrics?.viewsByMonth || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="views" 
                stroke="#8B5CF6" 
                strokeWidth={2} 
                name="Total Views" 
              />
              <Line 
                type="monotone" 
                dataKey="announcements" 
                stroke="#D4A76A" 
                strokeWidth={2} 
                name="Announcements Posted" 
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Deadline Status */}
        <Card>
          <CardHeader title="Report Deadline Status" icon={Clock} />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie 
                data={[
                  { name: 'Completed', value: deadlineMetrics?.completed || 0 },
                  { name: 'Pending', value: deadlineMetrics?.pending || 0 },
                  { name: 'Overdue', value: deadlineMetrics?.overdue || 0 },
                ]} 
                dataKey="value" 
                nameKey="name" 
                innerRadius={60} 
                outerRadius={100} 
                paddingAngle={2}
                label
              >
                <Cell fill="#22C55E" />
                <Cell fill="#F59E0B" />
                <Cell fill="#EF4444" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Follow-up Status */}
        <Card>
          <CardHeader title="Member Follow-ups Status" icon={Heart} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={followUpMetrics?.byStatus || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Announcements */}
        <Card>
          <CardHeader title="Most Viewed Announcements" icon={Eye} />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={announcementMetrics?.topAnnouncements || []} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="title" width={90} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="views" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>


      {/* Ministry Performance Metrics */}
      <Card>
        <CardHeader title="Ministry Performance Metrics" icon={Activity} />
        <div className="table-scroll">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ministry</th>
                <th className="px-4 py-3 text-center">Members</th>
                <th className="px-4 py-3 text-center">Reports (6mo)</th>
                <th className="px-4 py-3 text-center">Budgets (1yr)</th>
                <th className="px-4 py-3 text-center">Events (6mo)</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ministryMetrics.map((ministry) => (
                <tr key={ministry.ministry_id}>
                  <td className="px-4 py-3 font-medium text-ink">{ministry.ministry_name}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{ministry.member_count}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{ministry.reports_submitted}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{ministry.budgets_submitted}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{ministry.events_hosted}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={ministry.is_active ? 'green' : 'slate'}>
                      {ministry.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
