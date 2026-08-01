import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/EmptyState';
import { fetchMembers } from '@/services/members';
import { fetchMinistries } from '@/services/ministries';
import { fetchAttendanceSummary } from '@/services/attendance';
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

  const members = membersQuery.data ?? [];

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
          <h1 className="text-2xl font-bold text-ink">Reports</h1>
          <p className="text-sm text-slate-500">Member, attendance, and ministry statistics.</p>
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
    </div>
  );
}
