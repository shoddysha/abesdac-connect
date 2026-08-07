import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Download, Users, UserPlus, HandHeart, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { fetchMembers } from '@/services/members';
import { fetchMinistries } from '@/services/ministries';
import { fetchAttendanceSummary } from '@/services/attendance';
import { fetchRecentVisitors } from '@/services/visitors';
import { fetchPrayerRequests, getOpenPrayerRequestsCount } from '@/services/prayerRequests';
import { exportToCSV, exportToExcel, exportToPDF } from '@/utils/export';

const COLORS = ['#0F2A5F', '#1E5EFF', '#D4A76A', '#64748B', '#22C55E', '#EF4444'];

function getAgeBracket(dob: string | null) {
  if (!dob) return 'Unknown';
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 13) return 'Under 13';
  if (age < 18) return '13–17';
  if (age < 30) return '18–29';
  if (age < 50) return '30–49';
  if (age < 65) return '50–64';
  return '65+';
}

export function Reports() {
  const membersQuery = useQuery({ queryKey: ['members-report'], queryFn: () => fetchMembers({}) });
  const ministriesQuery = useQuery({ queryKey: ['ministries'], queryFn: fetchMinistries });
  const attendanceQuery = useQuery({
    queryKey: ['attendance-report'],
    queryFn: () => fetchAttendanceSummary(format(subDays(new Date(), 90), 'yyyy-MM-dd'), format(new Date(), 'yyyy-MM-dd')),
  });
  const visitorsQuery = useQuery({ queryKey: ['visitors-report'], queryFn: () => fetchRecentVisitors(100) });
  const prayerRequestsQuery = useQuery({ queryKey: ['prayer-requests-report'], queryFn: () => fetchPrayerRequests(100) });

  const members = membersQuery.data ?? [];
  const visitors = visitorsQuery.data ?? [];
  const prayerRequests = prayerRequestsQuery.data ?? [];

  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      const key = m.gender ?? 'Not specified';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [members]);

  const ageData = useMemo(() => {
    const order = ['Under 13', '13–17', '18–29', '30–49', '50–64', '65+', 'Unknown'];
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      const bracket = getAgeBracket(m.date_of_birth);
      counts[bracket] = (counts[bracket] ?? 0) + 1;
    });
    return order.filter((k) => counts[k]).map((name) => ({ name, value: counts[name] }));
  }, [members]);

  const ministryData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      const name = m.ministries?.name ?? 'Unassigned';
      counts[name] = (counts[name] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [members]);

  const attendanceByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    (attendanceQuery.data ?? []).forEach((row) => {
      counts[row.service_date] = (counts[row.service_date] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [attendanceQuery.data]);

  // Visitors statistics
  const visitorsThisMonth = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    return visitors.filter((v) => new Date(v.visit_date) >= monthStart).length;
  }, [visitors]);

  const visitorsNotFollowedUp = useMemo(() => {
    return visitors.filter((v) => !v.followed_up).length;
  }, [visitors]);

  const visitorsByMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    visitors.forEach((v) => {
      const month = format(new Date(v.visit_date), 'MMM yyyy');
      counts[month] = (counts[month] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
  }, [visitors]);

  // Prayer Requests statistics
  const openPrayerRequests = useMemo(() => {
    return prayerRequests.filter((p) => p.status === 'open').length;
  }, [prayerRequests]);

  const answeredPrayerRequests = useMemo(() => {
    return prayerRequests.filter((p) => p.status === 'answered').length;
  }, [prayerRequests]);

  const prayerRequestsByStatus = useMemo(() => {
    const open = prayerRequests.filter((p) => p.status === 'open').length;
    const ongoing = prayerRequests.filter((p) => p.status === 'ongoing').length;
    const answered = prayerRequests.filter((p) => p.status === 'answered').length;
    return [
      { name: 'Open', value: open },
      { name: 'Ongoing', value: ongoing },
      { name: 'Answered', value: answered },
    ].filter((item) => item.value > 0);
  }, [prayerRequests]);

  const memberStatRows = () =>
    members.map((m) => ({
      'Member ID': m.member_code,
      Name: `${m.first_name} ${m.last_name}`,
      Gender: m.gender,
      Status: m.status,
      District: m.district,
      Ministry: m.ministries?.name ?? '',
      'Date Joined': m.date_joined,
    }));

  if (membersQuery.isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Member, visitor, attendance, and ministry statistics.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCSV('member-report', memberStatRows())}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={() => exportToExcel('member-report', memberStatRows())}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              exportToPDF(
                'Member Report — Abeka SDA Church',
                'member-report',
                ['Member ID', 'Name', 'Gender', 'Status', 'District', 'Ministry'],
                members.map((m) => [m.member_code, `${m.first_name} ${m.last_name}`, m.gender ?? '', m.status, m.district ?? '', m.ministries?.name ?? ''])
              )
            }
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={members.length.toString()}
          icon={Users}
          tone="blue"
        />
        <StatCard
          title="Visitors This Month"
          value={visitorsThisMonth.toString()}
          subtitle={`${visitorsNotFollowedUp} need follow-up`}
          icon={UserPlus}
          tone="green"
        />
        <StatCard
          title="Open Prayer Requests"
          value={openPrayerRequests.toString()}
          subtitle={`${answeredPrayerRequests} answered`}
          icon={HandHeart}
          tone="purple"
        />
        <StatCard
          title="Active Ministries"
          value={(ministriesQuery.data ?? []).filter((m) => m.is_active).length.toString()}
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Gender distribution" />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {genderData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Age distribution" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ageData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#1E5EFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Members by ministry" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ministryData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#0F2A5F" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Attendance trend (last 90 days)" />
          {attendanceQuery.isLoading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attendanceByDate}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(Math.floor(attendanceByDate.length / 6), 0)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#D4A76A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="Visitor trends (last 6 months)" />
          {visitorsQuery.isLoading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={visitorsByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#22C55E" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="Prayer requests status" />
          {prayerRequestsQuery.isLoading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie 
                  data={prayerRequestsByStatus} 
                  dataKey="value" 
                  nameKey="name" 
                  innerRadius={55} 
                  outerRadius={90} 
                  paddingAngle={2}
                >
                  {prayerRequestsByStatus.map((entry, index) => {
                    const colorMap: Record<string, string> = {
                      'Open': '#3B82F6',
                      'Ongoing': '#F59E0B',
                      'Answered': '#22C55E',
                    };
                    return <Cell key={`cell-${index}`} fill={colorMap[entry.name] || COLORS[index]} />;
                  })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Ministry statistics" />
        <div className="table-scroll">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Ministry</th>
                <th className="px-4 py-2">Leader</th>
                <th className="px-4 py-2">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(ministriesQuery.data ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-medium text-ink">{m.name}</td>
                  <td className="px-4 py-2 text-slate-500">{m.profiles?.full_name ?? 'Unassigned'}</td>
                  <td className="px-4 py-2 text-slate-500">{members.filter((mem) => mem.ministry_id === m.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent visitors summary" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Total Visitors</span>
              <span className="text-lg font-bold text-ink">{visitors.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
              <span className="text-sm font-medium text-amber-700">Pending Follow-up</span>
              <span className="text-lg font-bold text-amber-700">{visitorsNotFollowedUp}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
              <span className="text-sm font-medium text-green-700">Followed Up</span>
              <span className="text-lg font-bold text-green-700">{visitors.filter((v) => v.followed_up).length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
              <span className="text-sm font-medium text-blue-700">This Month</span>
              <span className="text-lg font-bold text-blue-700">{visitorsThisMonth}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Prayer requests summary" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
              <span className="text-sm font-medium text-blue-700">Open Requests</span>
              <span className="text-lg font-bold text-blue-700">{openPrayerRequests}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
              <span className="text-sm font-medium text-amber-700">Ongoing</span>
              <span className="text-lg font-bold text-amber-700">{prayerRequests.filter((p) => p.status === 'ongoing').length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
              <span className="text-sm font-medium text-green-700">Answered</span>
              <span className="text-lg font-bold text-green-700">{answeredPrayerRequests}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-purple-50 p-3">
              <span className="text-sm font-medium text-purple-700">Anonymous</span>
              <span className="text-lg font-bold text-purple-700">{prayerRequests.filter((p) => p.is_anonymous).length}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
