import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns';
import {
  Users, Heart, BookOpen, HandHeart,
  TrendingUp, TrendingDown, Minus,
  CheckCircle2, Clock, AlertTriangle,
  ChevronRight, UserCheck,
} from 'lucide-react';
import { Spinner } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

export function PastorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const now = new Date();

  // ── Member stats ───────────────────────────────────────────────────────────
  const membersQuery = useQuery({
    queryKey: ['pastor-member-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, status, baptism_date, date_joined, is_archived')
        .eq('is_archived', false);
      if (error) throw error;
      const members = data ?? [];

      const oneYearAgo = subMonths(now, 12);
      const thisMonthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd   = endOfMonth(subMonths(now, 1));

      return {
        total:           members.filter(m => m.status === 'active').length,
        inactive:        members.filter(m => m.status === 'inactive').length,
        transferred:     members.filter(m => m.status === 'transferred').length,
        baptisedTotal:   members.filter(m => m.baptism_date).length,
        baptisedRecent:  members.filter(m => m.baptism_date && new Date(m.baptism_date) >= oneYearAgo).length,
        baptisedThisMonth: members.filter(m =>
          m.baptism_date &&
          new Date(m.baptism_date) >= thisMonthStart &&
          new Date(m.baptism_date) <= now
        ).length,
        newThisMonth:    members.filter(m =>
          m.date_joined && new Date(m.date_joined) >= thisMonthStart
        ).length,
        newLastMonth:    members.filter(m => {
          const d = m.date_joined ? new Date(m.date_joined) : null;
          return d && d >= lastMonthStart && d <= lastMonthEnd;
        }).length,
      };
    },
    staleTime: 0,
  });

  // ── Attendance trend (last 8 sabbaths) ────────────────────────────────────
  const attendanceQuery = useQuery({
    queryKey: ['pastor-attendance-trend'],
    queryFn: async () => {
      const eightWeeksAgo = subDays(now, 56).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance')
        .select('service_date, attendance_type')
        .eq('attendance_type', 'sabbath_service')
        .gte('service_date', eightWeeksAgo)
        .order('service_date', { ascending: true });
      if (error) throw error;

      // Group by service_date
      const grouped: Record<string, number> = {};
      for (const row of data ?? []) {
        grouped[row.service_date] = (grouped[row.service_date] ?? 0) + 1;
      }
      const dates = Object.keys(grouped).sort();
      const counts = dates.map(d => grouped[d]);

      // Trend: compare average of last 4 vs previous 4
      const recent   = counts.slice(-4).reduce((a, b) => a + b, 0) / Math.max(counts.slice(-4).length, 1);
      const previous = counts.slice(-8, -4).reduce((a, b) => a + b, 0) / Math.max(counts.slice(-8, -4).length, 1);
      const trendPct = previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 0;

      return {
        dates,
        counts,
        latest: counts[counts.length - 1] ?? 0,
        trendPct,
      };
    },
    staleTime: 0,
  });

  // ── Prayer requests ───────────────────────────────────────────────────────
  const prayerQuery = useQuery({
    queryKey: ['pastor-prayer-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_requests')
        .select('id, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const requests = data ?? [];
      return {
        open:     requests.filter(r => r.status === 'open').length,
        ongoing:  requests.filter(r => r.status === 'ongoing').length,
        answered: requests.filter(r => r.status === 'answered').length,
        recent:   requests.slice(0, 5),
      };
    },
    staleTime: 0,
  });

  // ── Pending follow-ups ────────────────────────────────────────────────────
  const followUpsQuery = useQuery({
    queryKey: ['pastor-followup-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_followups')
        .select('id, follow_up_type, priority, follow_up_date, completed_at, members(first_name, last_name)')
        .is('completed_at', null)
        .order('follow_up_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });

  const stats     = membersQuery.data;
  const attend    = attendanceQuery.data;
  const prayer    = prayerQuery.data;
  const followUps = followUpsQuery.data ?? [];

  const isLoading = membersQuery.isLoading || attendanceQuery.isLoading || prayerQuery.isLoading;

  if (isLoading) return <Spinner />;

  const trendIcon = !attend ? null :
    attend.trendPct > 0 ? <TrendingUp  className="h-4 w-4 text-green-500" /> :
    attend.trendPct < 0 ? <TrendingDown className="h-4 w-4 text-red-500" /> :
                          <Minus        className="h-4 w-4 text-slate-400" />;

  const trendColor = !attend ? '' :
    attend.trendPct > 0 ? 'text-green-600' :
    attend.trendPct < 0 ? 'text-red-500'   : 'text-slate-500';

  const maxCount = Math.max(...(attend?.counts ?? [1]), 1);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Pastor's Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome back, {profile?.full_name?.split(' ')[0]} — {format(now, 'EEEE, d MMMM yyyy')}
        </p>
      </div>

      {/* ── Row 1: Key metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Members',
            value: stats?.total ?? 0,
            sub: `+${stats?.newThisMonth ?? 0} this month`,
            icon: Users,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Inactive Members',
            value: stats?.inactive ?? 0,
            sub: 'Need pastoral attention',
            icon: AlertTriangle,
            color: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'Baptised This Year',
            value: stats?.baptisedRecent ?? 0,
            sub: `${stats?.baptisedTotal ?? 0} total baptised`,
            icon: UserCheck,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Open Prayer Requests',
            value: (prayer?.open ?? 0) + (prayer?.ongoing ?? 0),
            sub: `${prayer?.answered ?? 0} answered`,
            icon: HandHeart,
            color: 'bg-purple-50 text-purple-600',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-slate-500 font-medium">{label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                <p className="text-xs text-slate-400 mt-1">{sub}</p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Attendance chart + Prayer requests ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Attendance bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Sabbath Attendance</h2>
              <p className="text-xs text-slate-500">Last 8 services</p>
            </div>
            {attend && (
              <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
                {trendIcon}
                {attend.trendPct > 0 ? '+' : ''}{attend.trendPct}% trend
              </div>
            )}
          </div>
          {attend && attend.counts.length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {attend.counts.map((count, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs text-slate-500 font-medium">{count}</span>
                  <div
                    className="w-full rounded-t-sm bg-blue-500 transition-all"
                    style={{ height: `${(count / maxCount) * 80}px`, minHeight: 4 }}
                  />
                  <span className="text-xs text-slate-400 truncate w-full text-center">
                    {attend.dates[i] ? format(new Date(attend.dates[i]), 'M/d') : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No attendance records yet</p>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
            <span>Latest service: <strong className="text-slate-700">{attend?.latest ?? 0}</strong></span>
            <button
              onClick={() => navigate('/attendance')}
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              View full records <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Prayer requests summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Prayer Requests</h2>
              <p className="text-xs text-slate-500">Current status breakdown</p>
            </div>
            <button
              onClick={() => navigate('/prayer-requests')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Open',     value: prayer?.open ?? 0,     color: 'bg-red-50 text-red-600' },
              { label: 'Ongoing',  value: prayer?.ongoing ?? 0,  color: 'bg-amber-50 text-amber-600' },
              { label: 'Answered', value: prayer?.answered ?? 0, color: 'bg-green-50 text-green-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Answered prayer rate */}
          {((prayer?.open ?? 0) + (prayer?.ongoing ?? 0) + (prayer?.answered ?? 0)) > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Answered rate</span>
                <span className="font-medium text-slate-700">
                  {Math.round(
                    ((prayer?.answered ?? 0) /
                      Math.max((prayer?.open ?? 0) + (prayer?.ongoing ?? 0) + (prayer?.answered ?? 0), 1)) * 100
                  )}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${Math.round(
                      ((prayer?.answered ?? 0) /
                        Math.max((prayer?.open ?? 0) + (prayer?.ongoing ?? 0) + (prayer?.answered ?? 0), 1)) * 100
                    )}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Pending follow-ups + Quick links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pending follow-ups */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pending Follow-ups</h2>
              <p className="text-xs text-slate-500">Next 5 due</p>
            </div>
            <button
              onClick={() => navigate('/member-followup')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {followUps.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
              <p className="text-sm text-slate-500">All follow-ups are complete</p>
            </div>
          ) : (
            <div className="space-y-2">
              {followUps.map((fu: any) => (
                <div
                  key={fu.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => navigate('/member-followup')}
                >
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    fu.priority === 'high'   ? 'bg-red-500' :
                    fu.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {fu.members?.first_name} {fu.members?.last_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate capitalize">
                      {fu.follow_up_type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fu.follow_up_date ? format(new Date(fu.follow_up_date), 'd MMM') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Baptism Pipeline',
                desc: 'Track baptism status',
                icon: BookOpen,
                color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
                path: '/baptism-pipeline',
              },
              {
                label: 'Member Follow-up',
                desc: 'Pastoral care tracker',
                icon: Heart,
                color: 'bg-red-50 text-red-600 hover:bg-red-100',
                path: '/member-followup',
              },
              {
                label: 'Prayer Requests',
                desc: 'Manage & respond',
                icon: HandHeart,
                color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
                path: '/prayer-requests',
              },
              {
                label: 'New Announcement',
                desc: 'Publish to members',
                icon: Users,
                color: 'bg-green-50 text-green-600 hover:bg-green-100',
                path: '/announcements?action=add',
              },
            ].map(({ label, desc, icon: Icon, color, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`flex flex-col items-start gap-2 p-4 rounded-xl transition-colors text-left ${color}`}
              >
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs opacity-70">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── Membership growth summary ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Membership Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'New This Month',   value: stats?.newThisMonth  ?? 0, color: 'text-blue-600' },
            { label: 'New Last Month',   value: stats?.newLastMonth  ?? 0, color: 'text-slate-600' },
            { label: 'Baptised (Year)',  value: stats?.baptisedRecent ?? 0, color: 'text-green-600' },
            { label: 'Transferred Out', value: stats?.transferred    ?? 0, color: 'text-orange-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-slate-50">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 text-right">
          <button
            onClick={() => navigate('/members')}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 ml-auto"
          >
            View all members <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

    </div>
  );
}
