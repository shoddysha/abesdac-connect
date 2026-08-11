import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users,
  Calendar,
  TrendingUp,
  UserPlus,
  Phone,
  Mail,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Activity,
  BarChart3,
  Target,
  Award,
  ListTodo,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { supabase } from '@/lib/supabase';
import { fetchMinistries } from '@/services/ministries';
import { fetchAllMinistryLeaders } from '@/services/leaders';
import { getMinistryTaskStats } from '@/services/ministryTasks';
import { format, formatDistanceToNow } from 'date-fns';

export function MinistryDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);

  // Fetch ministry members
  const membersQuery = useQuery({
    queryKey: ['ministry-members', userMinistry?.id],
    queryFn: async () => {
      if (!userMinistry) return [];
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('ministry_id', userMinistry.id)
        .eq('status', 'active')
        .order('first_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!userMinistry,
  });

  // Fetch leadership team
  const leadersQuery = useQuery({
    queryKey: ['ministry-leaders'],
    queryFn: fetchAllMinistryLeaders,
  });

  // Fetch recent events for this ministry
  const eventsQuery = useQuery({
    queryKey: ['ministry-events', userMinistry?.id],
    queryFn: async () => {
      if (!userMinistry) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`ministry_id.eq.${userMinistry.id},created_by_role.eq.ministry_leader`)
        .order('start_time', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userMinistry,
  });

  // Fetch task stats
  const statsQuery = useQuery({
    queryKey: ['ministry-task-stats', userMinistry?.id],
    queryFn: () => getMinistryTaskStats(userMinistry!.id),
    enabled: !!userMinistry,
  });

  // Fetch ministry attendance stats
  const attendanceQuery = useQuery({
    queryKey: ['ministry-attendance', userMinistry?.id],
    queryFn: async () => {
      if (!userMinistry) return { total: 0, thisMonth: 0, lastMonth: 0 };
      
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const { data, error } = await supabase
        .from('attendance')
        .select('id, date')
        .gte('date', firstDayLastMonth.toISOString().split('T')[0]);

      if (error) throw error;

      const thisMonth = (data || []).filter(
        (a) => new Date(a.date) >= firstDayThisMonth
      ).length;
      const lastMonth = (data || []).filter(
        (a) =>
          new Date(a.date) >= firstDayLastMonth &&
          new Date(a.date) < firstDayThisMonth
      ).length;

      return { total: data?.length || 0, thisMonth, lastMonth };
    },
    enabled: !!userMinistry,
  });

  useRealtimeQuery('members', ['ministry-members', userMinistry?.id]);
  useRealtimeQuery('ministry_leaders', ['ministry-leaders']);
  useRealtimeQuery('events', ['ministry-events', userMinistry?.id]);
  useRealtimeQuery('ministry_tasks', ['ministry-task-stats', userMinistry?.id]);

  const members = membersQuery.data ?? [];
  const leaders = (leadersQuery.data ?? []).filter((l) => l.ministry_id === userMinistry?.id);
  const events = eventsQuery.data ?? [];
  const stats = statsQuery.data;
  const attendance = attendanceQuery.data;

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

  const attendanceGrowth = attendance
    ? attendance.lastMonth > 0
      ? ((attendance.thisMonth - attendance.lastMonth) / attendance.lastMonth) * 100
      : 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{userMinistry.name}</h1>
          <p className="text-sm text-slate-500">
            {userMinistry.description || 'Ministry Overview & Management'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/leaders')}>
            <Users className="h-4 w-4" /> Leadership Team
          </Button>
          <Button onClick={() => navigate('/events?action=add')}>
            <Calendar className="h-4 w-4" /> Create Event
          </Button>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Members" value={members.length} icon={Users} tone="primary" />
        <StatCard
          label="Leadership Team"
          value={leaders.length}
          icon={Award}
          tone="secondary"
        />
        <StatCard
          label="Pending Tasks"
          value={stats?.pending ?? 0}
          icon={ListTodo}
          tone="accent"
        />
        <StatCard
          label="Attendance Growth"
          value={`${attendanceGrowth > 0 ? '+' : ''}${attendanceGrowth.toFixed(0)}%`}
          icon={TrendingUp}
          tone={attendanceGrowth > 0 ? 'primary' : 'secondary'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ministry Members */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Ministry Members"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/members?ministry=${userMinistry.id}`)}
              >
                View All ({members.length})
              </Button>
            }
          />
          {membersQuery.isLoading ? (
            <Spinner />
          ) : members.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No members yet"
              description="Members will appear here when assigned to your ministry"
            />
          ) : (
            <div className="space-y-2">
              {members.slice(0, 8).map((member) => (
                <div
                  key={member.id}
                  onClick={() => navigate(`/members/${member.id}`)}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-50 text-secondary font-semibold">
                      {member.first_name[0]}
                      {member.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {member.first_name} {member.last_name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {member.phone}
                          </span>
                        )}
                        {member.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email}
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
            <EmptyState
              icon={Award}
              title="No leaders yet"
              description="Add deputy, secretary, and other leaders"
            />
          ) : (
            <div className="space-y-3">
              {leaders.map((leader) => (
                <div key={leader.id} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary text-xs font-semibold shrink-0">
                    {leader.member_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {leader.member_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge tone="blue">
                        {leader.leadership_role.replace('_', ' ')}
                      </Badge>
                    </div>
                    {leader.portfolio && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {leader.portfolio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Events & Quick Links */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent Events"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/events?action=add')}
              >
                Create Event
              </Button>
            }
          />
          {eventsQuery.isLoading ? (
            <Spinner />
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No events yet"
              description="Create your first ministry event"
            />
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{event.title}</p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(event.start_time), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  <Badge tone="blue">{event.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate(`/members?ministry=${userMinistry.id}`)}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm">View Members</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/ministry-tasks')}
            >
              <ListTodo className="h-5 w-5" />
              <span className="text-sm">Manage Tasks</span>
              {stats && stats.pending > 0 && (
                <Badge tone="amber">
                  {stats.pending} pending
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/ministry-reports')}
            >
              <FileText className="h-5 w-5" />
              <span className="text-sm">Submit Report</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/reports')}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm">View Analytics</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Ministry Goals & Objectives */}
      <Card>
        <CardHeader title="Ministry Vision & Goals" />
        <div className="prose prose-sm max-w-none">
          {userMinistry.description ? (
            <p className="text-slate-600">{userMinistry.description}</p>
          ) : (
            <EmptyState
              icon={Target}
              title="No vision statement"
              description="Add a vision and goals for your ministry in the Ministries page"
            />
          )}
        </div>
      </Card>
    </div>
  );
}
