import { useState } from 'react';
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
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemberStats } from '@/services/members';
import { fetchEvents } from '@/services/events';
import { fetchAuditLogs } from '@/services/audit';
import { fetchUpcomingBirthdays } from '@/services/birthdays';
import { fetchUnfollowedVisitors } from '@/services/visitors';
import { fetchAllMinistryReports } from '@/services/ministryReports';
import { supabase } from '@/lib/supabase';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import {
  format,
  isFuture,
  formatDistanceToNow,
  startOfMonth,
  endOfMonth,
  subMonths,
  getHours,
} from 'date-fns';

const DONUT_COLORS = ['#1d4ed8', '#d4a76a'];

function getGreeting() {
  const h = getHours(new Date());
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Sparkline mini chart
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map(v => ({ v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  trend?: { value: number; isPositive: boolean };
  sparkline?: number[];
  sparklineColor: string;
  iconBg: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, subtitle, trend, sparkline, sparklineColor, iconBg, icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.isPositive ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-sm text-slate-600 mb-3">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs text-slate-400">{subtitle}</p>
        {sparkline && sparkline.length > 1 && (
          <div className="w-24 h-10 flex-shrink-0">
            <Sparkline data={sparkline} color={sparklineColor} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { hasRole, profile } = useAuth();
  const [attendanceView, setAttendanceView] = useState<'week' | 'month'>('week');

  // ── Queries ──────────────────────────────────────────────────────────────
  const statsQuery = useQuery({ queryKey: ['member-stats'], queryFn: fetchMemberStats });
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents });
  const logsQuery = useQuery({ queryKey: ['audit-logs', 'recent'], queryFn: () => fetchAuditLogs(8) });
  const birthdaysQuery = useQuery({ queryKey: ['upcoming-birthdays'], queryFn: fetchUpcomingBirthdays });
  const visitorsQuery = useQuery({ queryKey: ['unfollowed-visitors'], queryFn: fetchUnfollowedVisitors });

  const reportsQuery = useQuery({
    queryKey: ['dashboard-reports'],
    queryFn: fetchAllMinistryReports,
    enabled: hasRole('administrator', 'secretary'),
  });

  // Member growth trend – last 6 months
  const memberTrendQuery = useQuery({
    queryKey: ['dashboard-member-trend'],
    queryFn: async () => {
      const months: number[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const { count } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', false)
          .lte('created_at', endOfMonth(date).toISOString());
        months.push(count || 0);
      }
      return months;
    },
  });

  // Active members trend
  const activeTrendQuery = useQuery({
    queryKey: ['dashboard-active-trend'],
    queryFn: async () => {
      const months: number[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const { count } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', false)
          .eq('status', 'active')
          .lte('created_at', endOfMonth(date).toISOString());
        months.push(count || 0);
      }
      return months;
    },
  });

  // Events trend (upcoming count per month)
  const eventsTrendQuery = useQuery({
    queryKey: ['dashboard-events-trend'],
    queryFn: async () => {
      const months: number[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const { count } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .gte('start_time', startOfMonth(date).toISOString())
          .lte('start_time', endOfMonth(date).toISOString());
        months.push(count || 0);
      }
      return months;
    },
  });

  // Ministry count trend
  const ministriesTrendQuery = useQuery({
    queryKey: ['dashboard-ministries-trend'],
    queryFn: async () => {
      const { data } = await supabase.from('ministries').select('id, name, is_active');
      return data || [];
    },
  });

  // Attendance by month (last 6)
  const attendanceMonthlyQuery = useQuery({
    queryKey: ['dashboard-attendance-monthly'],
    queryFn: async () => {
      const result = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const { data } = await supabase
          .from('attendance')
          .select('id')
          .gte('service_date', startOfMonth(date).toISOString().split('T')[0])
          .lte('service_date', endOfMonth(date).toISOString().split('T')[0]);
        result.push({ month: format(date, 'MMM'), count: data?.length || 0 });
      }
      return result;
    },
  });

  // Ministry member distribution (bar chart)
  const ministryDistQuery = useQuery({
    queryKey: ['dashboard-ministry-dist'],
    queryFn: async () => {
      const { data: ministries } = await supabase
        .from('ministries')
        .select('id, name')
        .eq('is_active', true)
        .limit(6);
      if (!ministries) return [];

      const result = await Promise.all(
        ministries.map(async m => {
          const { count } = await supabase
            .from('ministry_members')
            .select('*', { count: 'exact', head: true })
            .eq('ministry_id', m.id);
          return { name: m.name.split(' ')[0], members: count || 0 };
        })
      );
      return result.sort((a, b) => b.members - a.members);
    },
  });

  // Gender breakdown for donut
  const genderQuery = useQuery({
    queryKey: ['dashboard-gender'],
    queryFn: async () => {
      const { data } = await supabase
        .from('members')
        .select('gender')
        .eq('is_archived', false);
      const male = data?.filter(m => m.gender === 'male').length || 0;
      const female = data?.filter(m => m.gender === 'female').length || 0;
      const total = male + female;
      return { male, female, total, data: [{ name: 'Male', value: male }, { name: 'Female', value: female }] };
    },
  });

  // Realtime
  useRealtimeQuery('members', ['member-stats']);
  useRealtimeQuery('members', ['dashboard-member-trend']);
  useRealtimeQuery('members', ['dashboard-active-trend']);
  useRealtimeQuery('events', ['events']);
  useRealtimeQuery('events', ['dashboard-events-trend']);
  useRealtimeQuery('attendance', ['dashboard-attendance-monthly']);
  useRealtimeQuery('ministries', ['dashboard-ministries-trend']);
  useRealtimeQuery('ministry_members', ['dashboard-ministry-dist']);
  useRealtimeQuery('visitors', ['unfollowed-visitors']);
  useRealtimeQuery('audit_logs', ['audit-logs', 'recent']);

  // ── Derived data ─────────────────────────────────────────────────────────
  const stats = statsQuery.data;
  const ministries = ministriesTrendQuery.data ?? [];
  const upcomingEvents = (eventsQuery.data ?? [])
    .filter((e: any) => isFuture(new Date(e.start_time)))
    .slice(0, 5);
  const upcomingBirthdays = (birthdaysQuery.data ?? []).slice(0, 7);
  const unfollowedVisitors = (visitorsQuery.data ?? []).slice(0, 5);
  const reports = reportsQuery.data ?? [];
  const pendingReports = reports.filter((r: any) => !r.acknowledged_at);
  const ministryDist = ministryDistQuery.data ?? [];
  const attendanceData = attendanceMonthlyQuery.data ?? [];
  const gender = genderQuery.data;

  // Trend helpers
  function calcTrend(arr?: number[]): { value: number; isPositive: boolean } | undefined {
    if (!arr || arr.length < 2) return undefined;
    const prev = arr[arr.length - 2] || 1;
    const curr = arr[arr.length - 1];
    const diff = curr - prev;
    return { value: Math.abs(diff), isPositive: diff >= 0 };
  }

  const memberTrend = calcTrend(memberTrendQuery.data);
  const activeTrend = calcTrend(activeTrendQuery.data);
  const eventsTrend = calcTrend(eventsTrendQuery.data);

  const ministriesActive = ministries.filter((m: any) => m.is_active).length;

  return (
    <div className="space-y-6">

      {/* ── Greeting Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 mb-1">
            {format(new Date(), 'EEEE · yyyy')}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-slate-500 mt-1">
            Here's what's happening at Abeka SDA Church today.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Church in session
          </span>
        </div>
      </div>

      {/* ── 4 Stat Cards ────────────────────────────────────────────── */}
      {statsQuery.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Members"
            value={stats?.total ?? 0}
            subtitle="vs. last month"
            trend={memberTrend}
            sparkline={memberTrendQuery.data}
            sparklineColor="#3b82f6"
            iconBg="bg-blue-50"
            icon={<Users className="h-5 w-5 text-blue-600" />}
          />
          <StatCard
            label="Active Members"
            value={stats?.active ?? 0}
            subtitle="currently active"
            trend={activeTrend}
            sparkline={activeTrendQuery.data}
            sparklineColor="#10b981"
            iconBg="bg-green-50"
            icon={<UserCheck className="h-5 w-5 text-green-600" />}
          />
          <StatCard
            label="Active Ministries"
            value={ministriesActive}
            subtitle={`${ministries.length} total ministries`}
            sparkline={[ministriesActive, ministriesActive]}
            sparklineColor="#8b5cf6"
            iconBg="bg-purple-50"
            icon={<Building2 className="h-5 w-5 text-purple-600" />}
          />
          <StatCard
            label="Upcoming Events"
            value={upcomingEvents.length}
            subtitle="next 30 days"
            trend={eventsTrend}
            sparkline={eventsTrendQuery.data}
            sparklineColor="#f97316"
            iconBg="bg-orange-50"
            icon={<CalendarDays className="h-5 w-5 text-orange-500" />}
          />
        </div>
      )}

      {/* ── 3-Column Chart Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Bar chart – Ministry Members */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-semibold text-slate-900">Members by Ministry</h3>
              <p className="text-xs text-slate-400 mt-0.5">{format(new Date(), 'yyyy')}</p>
            </div>
            <Link to="/ministries" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {ministryDistQuery.isLoading ? (
            <div className="flex items-center justify-center h-48"><Spinner /></div>
          ) : ministryDist.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No ministry data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ministryDist} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="members" fill="#334155" radius={[4, 4, 0, 0]} name="Members" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Area chart – Attendance Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-semibold text-slate-900">Attendance Rate</h3>
              <p className="text-xs text-slate-400 mt-0.5">Church-wide</p>
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setAttendanceView('week')}
                className={`px-3 py-1.5 transition-colors ${attendanceView === 'week' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Week
              </button>
              <button
                onClick={() => setAttendanceView('month')}
                className={`px-3 py-1.5 transition-colors ${attendanceView === 'month' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Month
              </button>
            </div>
          </div>
          {attendanceMonthlyQuery.isLoading ? (
            <div className="flex items-center justify-center h-48"><Spinner /></div>
          ) : attendanceData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No attendance data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={attendanceData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#attendGrad)"
                  name="Attendance"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut – Gender / Reports summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-semibold text-slate-900">Gender Distribution</h3>
              <p className="text-xs text-slate-400 mt-0.5">All members</p>
            </div>
            {hasRole('administrator', 'secretary') && (
              <Link to="/members" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {genderQuery.isLoading ? (
            <div className="flex items-center justify-center h-48"><Spinner /></div>
          ) : !gender || gender.total === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No member data yet</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={gender.data}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {gender.data.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => [`${v} members`, '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend rows */}
              <div className="w-full space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
                    <span className="text-slate-600">Male</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-blue-700">{gender.male.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 ml-1">
                      ({gender.total > 0 ? Math.round((gender.male / gender.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-blue-700 transition-all duration-500"
                    style={{ width: `${gender.total > 0 ? (gender.male / gender.total) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-600">Female</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-amber-500">{gender.female.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 ml-1">
                      ({gender.total > 0 ? Math.round((gender.female / gender.total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${gender.total > 0 ? (gender.female / gender.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Recent Activity */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
            {hasRole('administrator', 'secretary', 'ministry_leader') && (
              <Link to="/audit-logs" className="text-xs font-medium text-blue-600 hover:underline">
                View all
              </Link>
            )}
          </div>
          {logsQuery.isLoading ? (
            <Spinner />
          ) : logsQuery.data && logsQuery.data.length > 0 ? (
            <div className="space-y-3">
              {logsQuery.data.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50">
                    <Activity className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 break-words leading-relaxed">
                      <span className="font-medium">{log.user_name ?? 'System'}</span>{' '}
                      {log.description}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title="No Activity Yet" />
          )}
        </div>

        {/* Upcoming Events */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Upcoming Events</h3>
            <Link to="/events" className="text-xs font-medium text-blue-600 hover:underline">View all</Link>
          </div>
          {eventsQuery.isLoading ? (
            <Spinner />
          ) : upcomingEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No Upcoming Events" description="Create one from Events." />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event: any) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white text-center">
                    <span className="text-[10px] font-semibold leading-none uppercase">
                      {format(new Date(event.start_time), 'MMM')}
                    </span>
                    <span className="text-base font-bold leading-none">
                      {format(new Date(event.start_time), 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{event.title}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {format(new Date(event.start_time), 'h:mm a')}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Birthdays + Quick Actions */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          {/* Upcoming Birthdays */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Upcoming Birthdays</h3>
              <Cake className="h-4 w-4 text-slate-400" />
            </div>
            {birthdaysQuery.isLoading ? (
              <Spinner />
            ) : upcomingBirthdays.length === 0 ? (
              <EmptyState icon={Cake} title="No Birthdays Soon" />
            ) : (
              <div className="space-y-2.5">
                {upcomingBirthdays.slice(0, 5).map((member: any) => (
                  <Link
                    key={member.id}
                    to={`/members/${member.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 text-xs font-bold">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(member.date_of_birth!), 'MMM d')}
                        </p>
                      </div>
                    </div>
                    {member.is_today ? (
                      <Badge tone="amber">Today!</Badge>
                    ) : (
                      <span className="text-xs text-slate-400 flex-shrink-0">{member.days_until}d</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/members?action=add', icon: UserPlus, label: 'Add Member', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
                { to: '/attendance', icon: ClipboardCheck, label: 'Attendance', color: 'text-green-600 bg-green-50 hover:bg-green-100' },
                { to: '/events?action=add', icon: CalendarDays, label: 'New Event', color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
                { to: '/announcements?action=add', icon: Megaphone, label: 'Announce', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
              ].map(item => (
                <Link key={item.to} to={item.to}>
                  <div className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors cursor-pointer ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ministry Reports Summary (admin/secretary only) ──────── */}
      {hasRole('administrator', 'secretary') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Ministry Reports Overview</h3>
              <p className="text-xs text-slate-400 mt-0.5">Current period</p>
            </div>
            <Link to="/all-ministry-reports" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{reports.length}</p>
                <p className="text-xs text-blue-600 font-medium">Total Reports</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <Activity className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-900">{pendingReports.length}</p>
                <p className="text-xs text-amber-600 font-medium">Pending Review</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">{reports.length - pendingReports.length}</p>
                <p className="text-xs text-green-600 font-medium">Acknowledged</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Visitors alert ───────────────────────────────────────── */}
      {unfollowedVisitors.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <UserPlus2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">Visitors Need Follow-up</h3>
                <p className="text-sm text-amber-700 mt-0.5">
                  {unfollowedVisitors.length} first-time visitor{unfollowedVisitors.length !== 1 ? 's' : ''} waiting for contact
                </p>
              </div>
            </div>
            <Link to="/visitors">
              <Button size="sm" variant="outline" className="flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100">
                View All
              </Button>
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
