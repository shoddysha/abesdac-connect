import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Cake, Church, Users as UsersIcon, type LucideIcon } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { fetchMember } from '@/services/members';
import { fetchAttendanceSummary } from '@/services/attendance';
import { useAuth } from '@/contexts/AuthContext';
import { MemberFormModal } from '@/pages/members/MemberFormModal';
import { format } from 'date-fns';

const PARTIAL_YEAR = 1900;

/** Renders a date_of_birth string for display.
 *  - Full date (e.g. "1985-03-22") → "Mar 22, 1985"
 *  - Partial date (year=1900 sentinel, e.g. "1900-08-14") → "Aug 14 (year unknown)"
 *  - null / empty → null (caller shows "—")
 */
function formatDob(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  if (date.getFullYear() === PARTIAL_YEAR) {
    return format(date, 'MMM d') + ' (year unknown)';
  }
  return format(date, 'MMM d, yyyy');
}

export function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const memberQuery = useQuery({ queryKey: ['member', id], queryFn: () => fetchMember(id!), enabled: !!id });

  if (memberQuery.isLoading) return <Spinner />;
  if (!memberQuery.data) return <p className="text-sm text-slate-500">Member not found.</p>;

  const m = memberQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {hasRole('administrator', 'secretary') && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-col items-center gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start">
          {m.profile_image_url ? (
            <img src={m.profile_image_url} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 text-2xl font-bold text-primary">
              {m.first_name[0]}
              {m.last_name[0]}
            </div>
          )}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold text-ink">
              {m.first_name} {m.last_name}
            </h1>
            <p className="text-sm text-slate-500">{m.member_code}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge tone={statusTone(m.status)}>{m.status}</Badge>
              {m.ministries?.name && <Badge tone="blue">{m.ministries.name}</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2">
          <InfoGroup title="Contact">
            <InfoRow icon={Phone} label="Phone" value={m.phone} />
            <InfoRow icon={Phone} label="Alternate phone" value={m.alternate_phone} />
            <InfoRow icon={Mail} label="Email" value={m.email} />
            <InfoRow icon={MapPin} label="Residential address" value={m.residential_address} />
            <InfoRow icon={MapPin} label="GPS address" value={m.gps_address} />
          </InfoGroup>

          <InfoGroup title="Personal">
            <InfoRow icon={Cake} label="Date of birth" value={formatDob(m.date_of_birth)} />
            <InfoRow label="Gender" value={m.gender} />
            <InfoRow label="Marital status" value={m.marital_status} />
            <InfoRow label="Occupation" value={m.occupation} />
            <InfoRow label="Nationality" value={m.nationality} />
          </InfoGroup>

          <InfoGroup title="Church">
            <InfoRow icon={Church} label="Baptism date" value={m.baptism_date} />
            <InfoRow label="Date joined" value={m.date_joined} />
            <InfoRow label="District" value={m.district} />
          </InfoGroup>

          <InfoGroup title="Family">
            <InfoRow icon={UsersIcon} label="Spouse" value={m.spouse_name} />
            <InfoRow label="Children" value={m.children_names} />
            <InfoRow label="Emergency contact" value={m.emergency_contact_name} />
            <InfoRow label="Emergency phone" value={m.emergency_contact_phone} />
          </InfoGroup>
        </div>
      </Card>

      <AttendanceHistory memberId={m.id} />

      <MemberFormModal
        open={editOpen}
        memberId={m.id}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: ['member', id] });
        }}
      />
    </div>
  );
}

function InfoGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-primary">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-ink">{value || '—'}</span>
    </div>
  );
}

function AttendanceHistory({ memberId }: { memberId: string }) {
  const ninetyDaysAgo = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const query = useQuery({
    queryKey: ['attendance-summary', memberId],
    queryFn: () => fetchAttendanceSummary(ninetyDaysAgo, today),
  });

  const memberRecords = (query.data ?? []).filter((r) => r.member_id === memberId);

  return (
    <Card>
      <CardHeader title="Attendance (last 90 days)" />
      {query.isLoading ? (
        <Spinner />
      ) : memberRecords.length === 0 ? (
        <p className="text-sm text-slate-400">No attendance recorded in this period.</p>
      ) : (
        <p className="text-sm text-ink">
          Attended <span className="font-semibold">{memberRecords.length}</span> service(s) or event(s) in the last 90 days.
        </p>
      )}
    </Card>
  );
}
