import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  FileText,
  Activity,
  Target,
  Award,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { supabase } from '@/lib/supabase';
import { fetchAllMinistryLeaders } from '@/services/leaders';
import { format, formatDistanceToNow } from 'date-fns';

export function MinistryDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // ── Ministry + members (single query) ────────────────────────────────────
  const ministryQuery = useQuery({
    queryKey: ['my-ministry-full', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from('ministries')
        .select('*, ministry_members(members(*))')
        .eq('leader_id', profile.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
    staleTime: 0,
  });

  const userMinistry = ministryQuery.data ?? null;

  const members = (userMinistry?.ministry_members ?? [])
    .map((row: any) => row.members)
    .filter((m: any) => m && m.status === 'active')
    .sort((a: any, b: any) => a.first_name.localeCompare(b.first_name));

  // ── Leadership team ───────────────────────────────────────────────────────
  const leadersQuery = useQuery({
    queryKey: ['ministry-leaders'],
    queryFn: fetchAllMinistryLeaders,
    staleTime: 0,
  });

  // ── Upcoming events ───────────────────────────────────────────────────────
  const eventsQuery = useQuery({
    queryKey: ['ministry-events'],
    queryFn: async () => {
      const today = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('start_time', today)
        .order('start_time', { ascending: true })
        .limit(5);
      if (error) throw error;
      if (!data || data.length === 0) {
        const { data: recent, error: recentError } = await supabase
          .from('events')
          .select('*')
          .order('start_time', { ascending: false})
          .limit(5);
        if (recentError) throw recentError;
        return recent || [];
      }
      return data;
    },
    staleTime: 0,
  });

  // ── Recent activity ───────────────────────────────────────────────────────
  const activityQuery = useQuery({
    queryKey: ['ministry-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
  });

  // ── Attendance stats ──────────────────────────────────────────────────────
  const attendanceQuery = useQuery({
    queryKey: ['ministry-attendance'],
    queryFn: async () => {
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { data, error } = await supabase
        .from('attendance')
        .select('id, service_date')
        .gte('service_date', firstDayLastMonth.toISOString().split('T')[0]);
      if (error) throw error;
      const thisMonth = (data || []).filter((a) => new Date(a.service_date) >= firstDayThisMonth).length;
      const lastMonth = (data || []).filter(
        (a) => new Date(a.service_date) >= firstDayLastMonth && new Date(a.service_date) < firstDayThisMonth,
      ).length;
      return { total: data?.length || 0, thisMonth, lastMonth };
    },
    staleTime: 0,
  });

  // ── Realtime ──────────────────────────────────────────────────────────────
  useRealtimeQuery('ministries', ['my-ministry-full', profile?.id]);
  useRealtimeQuery('ministry_members', ['my-ministry-full', profile?.id]);
  useRealtimeQuery('ministry_leaders', ['ministry-leaders']);
  useRealtimeQuery('events', ['ministry-events']);
  useRealtimeQuery('audit_logs', ['ministry-activity']);

  const leaders = (leadersQuery.data ?? []).filter((l) => l.ministry_id === userMinistry?.id);
  const events = eventsQuery.data ?? [];
  const attendance = attendanceQuery.data;

  const attendanceGrowth = attendance
    ? attendance.lastMonth > 0
      ? ((attendance.thisMonth - attendance.lastMonth) / attendance.lastMonth) * 100
      : 0
    : 0;

  // ── Loading / empty guards ────────────────────────────────────────────────
  if (ministryQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">My Ministry</h1>
        <Spinner />
      </div>
    );
  }

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">My Ministry</h1>
        <EmptyState
          icon={Users}
          title="No ministry assigned"
          description="You need to be assigned as a ministry leader to access this page"
        />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate">{userMinistry.name}</h1>
          <p className="text-sm text-slate-500">
            {userMinistry.description || 'Ministry Overview & Management'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/leaders')}>
            <Users className="h-4 w-4" /> Leadership Team
          </Button>
          <Button onClick={() => navigate('/events?action=add')}>
            <Calendar className="h-4 w-4" /> Create Event
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Members" value={members.length} icon={Users} tone="primary" />
        <StatCard label="Leadership Team" value={leaders.length} icon={Award} tone="secondary" />
        <StatCard
          label="Attendance Growth"
          value={`${attendanceGrowth > 0 ? '+' : ''}${attendanceGrowth.toFixed(0)}%`}
          icon={TrendingUp}
          tone={attendanceGrowth > 0 ? 'primary' : 'secondary'}
        />
      </div>

      {/* Members + Leaders */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ministry Members */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Ministry Members"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/members?ministry_id=${userMinistry.id}`)}
              >
                View All ({members.length})
              </Button>
            }
          />
          {ministryQuery.isLoading ? (
            <Spinner />
          ) : members.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No members yet"
              description="Members will appear here when assigned to your ministry"
            />
          ) : (
            <div className="space-y-2">
              {members.slice(0, 8).map((member: any) => (
                <div
                  key={member.id}
                  onClick={() => navigate(`/members/${member.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-50 text-secondary font-semibold shrink-0">
                      {member.first_name[0]}{member.last_name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500">
                        {member.phone && (
                          <span className="flex items-center gap-1 truncate">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{member.phone}</span>
                          </span>
                        )}
                        {member.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge tone="slate">{member.member_code}</Badge>
                </div>
              ))}
              {members.length > 8 && (
                <p className="text-center text-sm text-slate-500 pt-2">
                  +{members.length - 8} more members
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Leadership Team */}
        <Card>
          <CardHeader
            title="Leadership Team"
            action={
              <Button size="sm" variant="outline" onClick={() => navigate('/leaders')}>
                Manage
              </Button>
            }
          />
          {leadersQuery.isLoading ? (
            <Spinner />
          ) : leaders.length === 0 ? (
            <EmptyState icon={Award} title="No leaders yet" description="Add deputy, secretary, and other leaders" />
          ) : (
            <div className="space-y-3">
              {leaders.map((leader) => (
                <div key={leader.id} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary text-xs font-semibold shrink-0">
                    {leader.member_name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{leader.member_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge tone="blue">{leader.leadership_role.replace('_', ' ')}</Badge>
                    </div>
                    {leader.portfolio && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        <span className="truncate">{leader.portfolio}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming Events + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming Events"
            action={
              <Button size="sm" variant="outline" onClick={() => navigate('/events?action=add')}>
                Create Event
              </Button>
            }
          />
          {eventsQuery.isLoading ? (
            <Spinner />
          ) : events.length === 0 ? (
            <EmptyState icon={Calendar} title="No events yet" description="Create your first ministry event" />
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between rounded-lg border border-slate-100 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{event.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {format(new Date(event.start_time), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  <Badge tone="blue">{event.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate(`/members?ministry_id=${userMinistry.id}`)}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm text-center">View Members</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/submit-ministry-report')}
            >
              <FileText className="h-5 w-5" />
              <span className="text-sm text-center">Submit Report</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/submit-ministry-budget')}
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm text-center">Submit Budget</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/member-followup')}
            >
              <Target className="h-5 w-5" />
              <span className="text-sm text-center">Follow-ups</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader title="Recent Activity" />
        {activityQuery.isLoading ? (
          <Spinner />
        ) : activityQuery.data && activityQuery.data.length > 0 ? (
          <div className="space-y-3">
            {activityQuery.data.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                <p className="text-ink break-words">
                  <span className="font-medium">{log.user_name ?? 'System'}</span>{' '}
                  {log.description}
                  <span className="ml-2 text-xs text-slate-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Activity} title="No recent activity" description="Recent ministry activities will appear here" />
        )}
      </Card>

      {/* Ministry Vision & Goals */}
      <Card>
        <CardHeader title="Ministry Vision & Goals" />
        {userMinistry.description ? (
          <p className="text-slate-600 text-sm">{userMinistry.description}</p>
        ) : (
          <EmptyState
            icon={Target}
            title="No vision statement"
            description="Add a vision and goals for your ministry in the Ministries page"
          />
        )}
      </Card>
    </div>
  );
}
