import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, UserCheck, CalendarDays, Activity, UserPlus, ClipboardCheck, Megaphone, Cake, UserPlus2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fetchMemberStats } from '@/services/members';
import { fetchEvents } from '@/services/events';
import { fetchAuditLogs } from '@/services/audit';
import { fetchUpcomingBirthdays } from '@/services/birthdays';
import { fetchUnfollowedVisitors } from '@/services/visitors';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { format, isFuture, formatDistanceToNow } from 'date-fns';

const GENDER_COLORS = ['#1E5EFF', '#D4A76A'];

export function Dashboard() {
  const statsQuery = useQuery({ queryKey: ['member-stats'], queryFn: fetchMemberStats });
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents });
  const logsQuery = useQuery({ queryKey: ['audit-logs', 'recent'], queryFn: () => fetchAuditLogs(8) });
  const birthdaysQuery = useQuery({ queryKey: ['upcoming-birthdays'], queryFn: fetchUpcomingBirthdays });
  const visitorsQuery = useQuery({ queryKey: ['unfollowed-visitors'], queryFn: fetchUnfollowedVisitors });

  useRealtimeQuery('members', ['member-stats']);
  useRealtimeQuery('members', ['upcoming-birthdays']);
  useRealtimeQuery('events', ['events']);
  useRealtimeQuery('audit_logs', ['audit-logs', 'recent']);
  useRealtimeQuery('visitors', ['unfollowed-visitors']);

  const stats = statsQuery.data;
  const upcomingEvents = (eventsQuery.data ?? []).filter((e) => isFuture(new Date(e.start_time))).slice(0, 5);
  const upcomingBirthdays = (birthdaysQuery.data ?? []).slice(0, 7);
  const unfollowedVisitors = (visitorsQuery.data ?? []).slice(0, 5);

  const genderData = stats
    ? [
        { name: 'Male', value: stats.male },
        { name: 'Female', value: stats.female },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back — here's what's happening at Abeka SDA Church.</p>
      </div>

      {statsQuery.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total members" value={stats?.total ?? 0} icon={Users} tone="primary" />
          <StatCard label="Active members" value={stats?.active ?? 0} icon={UserCheck} tone="secondary" />
          <StatCard label="Male members" value={stats?.male ?? 0} icon={Users} tone="primary" />
          <StatCard label="Female members" value={stats?.female ?? 0} icon={Users} tone="accent" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Gender distribution" />
          {stats && stats.total > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {genderData.map((_, i) => (
                    <Cell key={i} fill={GENDER_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No member data yet</p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Upcoming events" action={<Link to="/events" className="text-sm font-medium text-secondary hover:underline">View all</Link>} />
          {upcomingEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No upcoming events" description="Create one from the Events page." />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{event.title}</p>
                    <p className="text-xs text-slate-500">{event.location}</p>
                  </div>
                  <span className="text-xs font-medium text-secondary">
                    {format(new Date(event.start_time), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" />
          {logsQuery.isLoading ? (
            <Spinner />
          ) : logsQuery.data && logsQuery.data.length > 0 ? (
            <div className="space-y-3">
              {logsQuery.data.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <p className="text-ink">
                    <span className="font-medium">{log.user_name ?? 'System'}</span> {log.description}
                    <span className="ml-2 text-xs text-slate-400">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title="No activity yet" />
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming birthdays" action={<Cake className="h-4 w-4 text-slate-400" />} />
          {birthdaysQuery.isLoading ? (
            <Spinner />
          ) : birthdaysQuery.error ? (
            <EmptyState icon={Cake} title="Unable to load birthdays" description="Check that members have birth dates entered." />
          ) : upcomingBirthdays.length === 0 ? (
            <EmptyState icon={Cake} title="No birthdays soon" description="No member birthdays in the next 30 days." />
          ) : (
            <div className="space-y-2">
              {upcomingBirthdays.map((member) => (
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Quick actions" />
          <div className="flex flex-col gap-2">
            <Link to="/members?action=add">
              <Button variant="outline" className="w-full justify-start">
                <UserPlus className="h-4 w-4" /> Add member
              </Button>
            </Link>
            <Link to="/attendance">
              <Button variant="outline" className="w-full justify-start">
                <ClipboardCheck className="h-4 w-4" /> Record attendance
              </Button>
            </Link>
            <Link to="/events?action=add">
              <Button variant="outline" className="w-full justify-start">
                <CalendarDays className="h-4 w-4" /> Create event
              </Button>
            </Link>
            <Link to="/announcements?action=add">
              <Button variant="outline" className="w-full justify-start">
                <Megaphone className="h-4 w-4" /> Post announcement
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader 
            title="First-time visitors" 
            action={
              <div className="flex items-center gap-2">
                {unfollowedVisitors.length > 0 && (
                  <Badge tone="amber">{unfollowedVisitors.length} need follow-up</Badge>
                )}
                <UserPlus2 className="h-4 w-4 text-slate-400" />
              </div>
            } 
          />
          {visitorsQuery.isLoading ? (
            <Spinner />
          ) : unfollowedVisitors.length === 0 ? (
            <EmptyState 
              icon={UserPlus2} 
              title="All caught up!" 
              description="No visitors waiting for follow-up. Visitor tracking coming soon." 
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500 mb-3">
                These visitors need follow-up contact from pastoral team
              </p>
              {unfollowedVisitors.map((visitor) => (
                <div
                  key={visitor.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {visitor.first_name} {visitor.last_name}
                    </p>
                    <p className="text-xs text-slate-500">
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
      </div>
    </div>
  );
}
