import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Users, 
  UserCheck, 
  CalendarDays, 
  Activity, 
  UserPlus, 
  ClipboardCheck, 
  Megaphone, 
  Cake, 
  UserPlus2,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { EnhancedStatCard } from '@/components/ui/EnhancedStatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { NotificationsButton } from '@/components/NotificationsButton';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemberStats } from '@/services/members';
import { fetchEvents } from '@/services/events';
import { fetchAuditLogs } from '@/services/audit';
import { fetchUpcomingBirthdays } from '@/services/birthdays';
import { fetchUnfollowedVisitors } from '@/services/visitors';
import { fetchAllMinistryReports } from '@/services/ministryReports';
import { supabase } from '@/lib/supabase';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { format, isFuture, formatDistanceToNow, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const GENDER_COLORS = ['#1E5EFF', '#D4A76A'];

export function Dashboard() {
  const { hasRole, profile } = useAuth();
  
  const statsQuery = useQuery({ queryKey: ['member-stats'], queryFn: fetchMemberStats });
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents });
  const logsQuery = useQuery({ queryKey: ['audit-logs', 'recent'], queryFn: () => fetchAuditLogs(8) });
  const birthdaysQuery = useQuery({ queryKey: ['upcoming-birthdays'], queryFn: fetchUpcomingBirthdays });
  const visitorsQuery = useQuery({ queryKey: ['unfollowed-visitors'], queryFn: fetchUnfollowedVisitors });

  // New queries for enhanced features
  const reportsQuery = useQuery({
    queryKey: ['dashboard-reports'],
    queryFn: fetchAllMinistryReports,
    enabled: hasRole('administrator', 'secretary'),
  });

  const attendanceQuery = useQuery({
    queryKey: ['dashboard-attendance-trend'],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        
        const { data, error } = await supabase
          .from('attendance')
          .select('id')
          .gte('service_date', start.toISOString().split('T')[0])
          .lte('service_date', end.toISOString().split('T')[0]);
        
        if (error) throw error;
        
        months.push({
          month: format(date, 'MMM'),
          count: data?.length || 0,
        });
      }
      return months;
    },
  });

  // Get member growth trend (last 6 months)
  const memberTrendQuery = useQuery({
    queryKey: ['dashboard-member-trend'],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const end = endOfMonth(date);
        
        const { count, error } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', end.toISOString());
        
        if (error) throw error;
        months.push(count || 0);
      }
      return months;
    },
  });

  // Get active members trend
  const activeMemberTrendQuery = useQuery({
    queryKey: ['dashboard-active-member-trend'],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const end = endOfMonth(date);
        
        const { count, error } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .lte('created_at', end.toISOString());
        
        if (error) throw error;
        months.push(count || 0);
      }
      return months;
    },
  });

  const ministriesQuery = useQuery({
    queryKey: ['dashboard-ministries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ministries')
        .select('id, name, is_active');
      if (error) throw error;
      return data || [];
    },
  });

  useRealtimeQuery('members', ['member-stats']);
  useRealtimeQuery('members', ['upcoming-birthdays']);
  useRealtimeQuery('events', ['events']);
  useRealtimeQuery('audit_logs', ['audit-logs', 'recent']);
  useRealtimeQuery('visitors', ['unfollowed-visitors']);
  useRealtimeQuery('ministry_reports', ['dashboard-reports']);

  const stats = statsQuery.data;
  const upcomingEvents = (eventsQuery.data ?? []).filter((e: any) => isFuture(new Date(e.start_time))).slice(0, 5);
  const upcomingBirthdays = (birthdaysQuery.data ?? []).slice(0, 7);
  const unfollowedVisitors = (visitorsQuery.data ?? []).slice(0, 5);
  const reports = reportsQuery.data ?? [];
  const ministries = ministriesQuery.data ?? [];
  
  const pendingReports = reports.filter((r: any) => !r.acknowledged_at);
  const acknowledgedReports = reports.filter((r: any) => r.acknowledged_at);

  const genderData = stats
    ? [
        { name: 'Male', value: stats.male },
        { name: 'Female', value: stats.female },
      ]
    : [];

  const attendanceTrend = attendanceQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header with greeting and actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-sm text-slate-500">Here's what's happening at Abeka SDA Church today.</p>
        </div>
        <div className="flex gap-2">
          <NotificationsButton />
        </div>
      </div>

      {/* Key Stats */}
      {statsQuery.isLoading || memberTrendQuery.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EnhancedStatCard
            label="Total Members"
            value={stats?.total ?? 0}
            icon={Users}
            tone="blue"
            sparklineData={memberTrendQuery.data}
            trend={
              memberTrendQuery.data && memberTrendQuery.data.length >= 2
                ? {
                    value: Number(
                      (
                        ((memberTrendQuery.data[memberTrendQuery.data.length - 1] -
                          memberTrendQuery.data[memberTrendQuery.data.length - 2]) /
                          (memberTrendQuery.data[memberTrendQuery.data.length - 2] || 1)) *
                        100
                      ).toFixed(1)
                    ),
                    isPositive:
                      memberTrendQuery.data[memberTrendQuery.data.length - 1] >=
                      memberTrendQuery.data[memberTrendQuery.data.length - 2],
                  }
                : undefined
            }
            subtitle="All registered"
          />
          <EnhancedStatCard
            label="Active Members"
            value={stats?.active ?? 0}
            icon={UserCheck}
            tone="green"
            sparklineData={activeMemberTrendQuery.data}
            trend={
              activeMemberTrendQuery.data && activeMemberTrendQuery.data.length >= 2
                ? {
                    value: Number(
                      (
                        ((activeMemberTrendQuery.data[activeMemberTrendQuery.data.length - 1] -
                          activeMemberTrendQuery.data[activeMemberTrendQuery.data.length - 2]) /
                          (activeMemberTrendQuery.data[activeMemberTrendQuery.data.length - 2] || 1)) *
                        100
                      ).toFixed(1)
                    ),
                    isPositive:
                      activeMemberTrendQuery.data[activeMemberTrendQuery.data.length - 1] >=
                      activeMemberTrendQuery.data[activeMemberTrendQuery.data.length - 2],
                  }
                : undefined
            }
            subtitle="Currently active"
          />
          <EnhancedStatCard
            label="Active Ministries"
            value={ministries.filter((m: any) => m.is_active).length}
            icon={Building2}
            tone="purple"
            subtitle={`${ministries.length} total`}
          />
          <EnhancedStatCard
            label="Upcoming Events"
            value={upcomingEvents.length}
            icon={CalendarDays}
            tone="orange"
            subtitle="Next 30 days"
          />
        </div>
      )}

      {/* Alerts & Notifications Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Visitors needing follow-up */}
        {unfollowedVisitors.length > 0 && (
          <Card className="border-l-4 border-l-amber-500">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-ink">Visitors Need Follow-up</h3>
                <p className="text-xs text-slate-600 mt-1">
                  {unfollowedVisitors.length} first-time visitor{unfollowedVisitors.length !== 1 ? 's' : ''} waiting for contact
                </p>
                <Link to="/visitors">
                  <Button size="sm" variant="outline" className="mt-2">
                    View All
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Upcoming birthdays this week */}
        {upcomingBirthdays.filter((b: any) => b.days_until <= 7).length > 0 && (
          <Card className="border-l-4 border-l-green-500">
            <div className="flex items-start gap-3">
              <Cake className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-ink">Birthdays This Week</h3>
                <p className="text-xs text-slate-600 mt-1">
                  {upcomingBirthdays.filter((b: any) => b.days_until <= 7).length} member{upcomingBirthdays.filter((b: any) => b.days_until <= 7).length !== 1 ? 's' : ''} celebrating
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  {upcomingBirthdays.filter((b: any) => b.days_until <= 7).slice(0, 3).map((b: any) => (
                    <div key={b.id}>{b.first_name} {b.last_name}</div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Attendance Trend Chart & Quick Stats */}
      {hasRole('administrator', 'secretary') && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Attendance Rate" />
            {attendanceQuery.isLoading ? (
              <Spinner />
            ) : attendanceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={attendanceTrend}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fill="url(#colorAttendance)"
                    name="Attendance"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">No attendance data yet</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Quick Links" />
            <div className="grid grid-cols-2 gap-3">
              <Link to="/members">
                <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4">
                  <Users className="h-5 w-5" />
                  <span className="text-sm text-center">Members</span>
                </Button>
              </Link>
              <Link to="/ministries">
                <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4">
                  <Building2 className="h-5 w-5" />
                  <span className="text-sm text-center">Ministries</span>
                </Button>
              </Link>
              <Link to="/events">
                <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4">
                  <CalendarDays className="h-5 w-5" />
                  <span className="text-sm text-center">Events</span>
                </Button>
              </Link>
              <Link to="/all-ministry-reports">
                <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4">
                  <FileText className="h-5 w-5" />
                  <span className="text-sm text-center">Reports</span>
                </Button>
              </Link>
              <Link to="/visitors">
                <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4">
                  <UserPlus2 className="h-5 w-5" />
                  <span className="text-sm text-center">Visitors</span>
                </Button>
              </Link>
              <Link to="/announcements">
                <Button variant="outline" className="w-full h-auto flex-col gap-2 py-4">
                  <Megaphone className="h-5 w-5" />
                  <span className="text-sm text-center">Announcements</span>
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader 
            title="First-Time Visitors" 
            action={
              <div className="flex flex-wrap items-center gap-2">
                {unfollowedVisitors.length > 0 && (
                  <Badge tone="amber">{unfollowedVisitors.length} need follow-up</Badge>
                )}
                <Link to="/visitors" className="text-sm font-medium text-secondary hover:underline">
                  View All
                </Link>
              </div>
            } 
          />
          {visitorsQuery.isLoading ? (
            <Spinner />
          ) : unfollowedVisitors.length === 0 ? (
            <EmptyState 
              icon={UserPlus2} 
              title="All Caught Up!" 
              description="No visitors waiting for follow-up." 
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500 mb-3">
                These visitors need follow-up contact from pastoral team
              </p>
              {unfollowedVisitors.map((visitor: any) => (
                <div
                  key={visitor.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {visitor.first_name} {visitor.last_name}
                    </p>
                    <p className="text-xs text-slate-500 break-words">
                      Visited {format(new Date(visitor.visit_date), 'MMM d, yyyy')}
                      {visitor.phone_number && ` · ${visitor.phone_number}`}
                    </p>
                  </div>
                  <Badge tone="amber">Pending</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Upcoming Events" action={<Link to="/events" className="text-sm font-medium text-secondary hover:underline">View All</Link>} />
          {upcomingEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No Upcoming Events" description="Create one from the Events page." />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event: any) => (
                <div key={event.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{event.title}</p>
                    <p className="text-xs text-slate-500 truncate">{event.location}</p>
                  </div>
                  <span className="text-xs font-medium text-secondary whitespace-nowrap">
                    {format(new Date(event.start_time), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Ministry Reports Overview (Admin/Secretary only) */}
      {hasRole('administrator', 'secretary') && (
        <Card>
          <CardHeader 
            title="Ministry Reports Overview" 
            action={<Link to="/ministry-reports" className="text-sm font-medium text-secondary hover:underline">View All</Link>}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-900">{reports.length}</p>
                <p className="text-xs text-blue-600">Total Reports</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
              <Clock className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-900">{pendingReports.length}</p>
                <p className="text-xs text-amber-600">Pending Review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-900">{acknowledgedReports.length}</p>
                <p className="text-xs text-green-600">Acknowledged</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Activity & Birthdays */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader 
            title="Recent Activity" 
            action={
              hasRole('administrator', 'secretary', 'ministry_leader') ? (
                <Link to="/audit-logs" className="text-sm font-medium text-secondary hover:underline">
                  View All
                </Link>
              ) : undefined
            }
          />
          {logsQuery.isLoading ? (
            <Spinner />
          ) : logsQuery.data && logsQuery.data.length > 0 ? (
            <div className="space-y-3">
              {logsQuery.data.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <p className="text-ink break-words">
                    <span className="font-medium">{log.user_name ?? 'System'}</span> {log.description}
                    <span className="ml-2 text-xs text-slate-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title="No Activity Yet" />
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming Birthdays" action={<Cake className="h-4 w-4 text-slate-400" />} />
          {birthdaysQuery.isLoading ? (
            <Spinner />
          ) : birthdaysQuery.error ? (
            <EmptyState icon={Cake} title="Unable to Load Birthdays" description="Check that members have birth dates entered." />
          ) : upcomingBirthdays.length === 0 ? (
            <EmptyState icon={Cake} title="No Birthdays Soon" description="No member birthdays in the next 30 days." />
          ) : (
            <div className="space-y-2">
              {upcomingBirthdays.map((member: any) => (
                <Link
                  key={member.id}
                  to={`/members/${member.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(member.date_of_birth!), 'MMM d')}
                    </p>
                  </div>
                  {member.is_today ? (
                    <Badge tone="amber">Today!</Badge>
                  ) : (
                    <span className="text-xs text-slate-400">{member.days_until}d</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Row - Quick Actions & Stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="flex flex-col gap-2">
            <Link to="/members?action=add">
              <Button variant="outline" className="w-full justify-start">
                <UserPlus className="h-4 w-4" /> <span className="truncate">Add Member</span>
              </Button>
            </Link>
            <Link to="/attendance">
              <Button variant="outline" className="w-full justify-start">
                <ClipboardCheck className="h-4 w-4" /> <span className="truncate">Record Attendance</span>
              </Button>
            </Link>
            <Link to="/events?action=add">
              <Button variant="outline" className="w-full justify-start">
                <CalendarDays className="h-4 w-4" /> <span className="truncate">Create Event</span>
              </Button>
            </Link>
            <Link to="/announcements?action=add">
              <Button variant="outline" className="w-full justify-start">
                <Megaphone className="h-4 w-4" /> <span className="truncate">Post Announcement</span>
              </Button>
            </Link>
            {hasRole('ministry_leader') && (
              <Link to="/submit-ministry-report">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4" /> <span className="truncate">Submit Report</span>
                </Button>
              </Link>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Gender Distribution" />
          {stats && stats.total > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={true}
                  >
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={GENDER_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} members`, '']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              {/* Distribution bars below the chart */}
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {genderData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2 sm:gap-3">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: GENDER_COLORS[i] }}
                    />
                    <span className="w-12 sm:w-14 text-sm font-medium text-ink">{entry.name}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: stats.total > 0
                            ? `${Math.round((entry.value / stats.total) * 100)}%`
                            : '0%',
                          backgroundColor: GENDER_COLORS[i],
                        }}
                      />
                    </div>
                    <span className="w-16 sm:w-20 text-right text-xs sm:text-sm text-slate-500 whitespace-nowrap">
                      {entry.value} ({stats.total > 0 ? Math.round((entry.value / stats.total) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No member data yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
