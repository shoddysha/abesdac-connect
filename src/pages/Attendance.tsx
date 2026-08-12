import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ClipboardCheck, LogIn, LogOut, Search, QrCode, Download } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchMembers } from '@/services/members';
import { fetchEvents } from '@/services/events';
import { fetchAttendanceByDate, checkInMember, checkOutMember } from '@/services/attendance';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import type { AttendanceType } from '@/types/database';
import { QrCheckInModal } from '@/features/checkin/QrCheckInModal';

const TYPE_LABELS: Record<AttendanceType, string> = {
  sabbath_service: 'Sabbath service',
  midweek_service: 'Midweek service',
  event: 'Event',
};

export function Attendance() {
  const { profile, hasRole } = useAuth();
  const canManage = hasRole('administrator', 'secretary', 'ministry_leader');
  const queryClient = useQueryClient();

  const [serviceDate, setServiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('sabbath_service');
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const membersQuery = useQuery({ queryKey: ['members', { status: 'active' }], queryFn: () => fetchMembers({ status: 'active' }) });
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: fetchEvents });
  const attendanceQuery = useQuery({
    queryKey: ['attendance', serviceDate, attendanceType, eventId],
    queryFn: () => fetchAttendanceByDate(serviceDate, attendanceType, eventId || undefined),
  });
  useRealtimeQuery('attendance', ['attendance', serviceDate, attendanceType, eventId]);

  const attendanceByMember = useMemo(() => {
    const map = new Map<string, { id: string; check_in_time: string | null; check_out_time: string | null }>();
    (attendanceQuery.data ?? []).forEach((row: any) => map.set(row.member_id, row));
    return map;
  }, [attendanceQuery.data]);

  const filteredMembers = (membersQuery.data ?? []).filter((m) =>
    `${m.first_name} ${m.last_name} ${m.member_code}`.toLowerCase().includes(search.toLowerCase())
  );

  const presentCount = attendanceQuery.data?.length ?? 0;
  const totalCount = membersQuery.data?.length ?? 0;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  async function handleCheckIn(memberId: string) {
    if (!profile) return;
    try {
      await checkInMember({
        member_id: memberId,
        attendance_type: attendanceType,
        service_date: serviceDate,
        event_id: attendanceType === 'event' ? eventId || null : null,
        recorded_by: profile.id,
      });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleCheckOut(attendanceId: string) {
    await checkOutMember(attendanceId);
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  }

  function exportToCSV() {
    if (!attendanceQuery.data?.length) {
      toast.error('No attendance data to export');
      return;
    }

    const headers = ['Member Code', 'First Name', 'Last Name', 'Check-in Time', 'Check-out Time', 'Duration (min)'];
    const rows = filteredMembers
      .map((member) => {
        const record = attendanceByMember.get(member.id);
        if (!record) return null;

        const checkIn = record.check_in_time ? new Date(record.check_in_time) : null;
        const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
        const duration = checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : '';

        return [
          member.member_code,
          member.first_name,
          member.last_name,
          checkIn ? format(checkIn, 'h:mm a') : '',
          checkOut ? format(checkOut, 'h:mm a') : '',
          duration,
        ];
      })
      .filter((row): row is (string | number)[] => row !== null);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${serviceDate}_${attendanceType}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Attendance exported');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Attendance</h1>
          <p className="text-sm text-slate-500">Record check-ins for services and events.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && presentCount > 0 && (
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              onClick={() => setQrModalOpen(true)}
              disabled={attendanceType === 'event' && !eventId}
            >
              <QrCode className="h-4 w-4" /> <span className="hidden sm:inline">QR check-in</span>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
          />
          <Select
            value={attendanceType}
            onChange={(e) => {
              setAttendanceType(e.target.value as AttendanceType);
              setEventId('');
            }}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {attendanceType === 'event' && (
            <Select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="Select event"
              options={[
                { value: '', label: 'Select event' },
                ...(eventsQuery.data ?? []).map((e) => ({ value: e.id, label: e.title })),
              ]}
            />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">Present</p>
          <p className="text-2xl font-bold text-ink">{presentCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Total active members</p>
          <p className="text-2xl font-bold text-ink">{totalCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Attendance rate</p>
          <p className="text-2xl font-bold text-secondary">{percentage}%</p>
        </Card>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members to check in…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
        />
      </div>

      {membersQuery.isLoading || attendanceQuery.isLoading ? (
        <Spinner />
      ) : filteredMembers.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No members found" />
      ) : attendanceType === 'event' && !eventId ? (
        <EmptyState icon={ClipboardCheck} title="Select an event above to begin" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member) => {
                const record = attendanceByMember.get(member.id);
                return (
                  <tr key={member.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-ink">
                      {member.first_name} {member.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {record?.check_in_time ? format(new Date(record.check_in_time), 'h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {record?.check_out_time ? format(new Date(record.check_out_time), 'h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && !record && (
                        <Button size="sm" onClick={() => handleCheckIn(member.id)}>
                          <LogIn className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Check in</span>
                        </Button>
                      )}
                      {canManage && record && !record.check_out_time && (
                        <Button size="sm" variant="outline" onClick={() => handleCheckOut(record.id)}>
                          <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Check out</span>
                        </Button>
                      )}
                      {record?.check_out_time && <span className="text-xs text-emerald-600">Complete</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <QrCheckInModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        attendanceType={attendanceType}
        serviceDate={serviceDate}
        eventId={attendanceType === 'event' ? eventId : undefined}
        presentCount={presentCount}
      />
    </div>
  );
}
