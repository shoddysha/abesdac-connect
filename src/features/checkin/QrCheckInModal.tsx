import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Copy, StopCircle, QrCode as QrCodeIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  createCheckinSession,
  fetchActiveCheckinSession,
  deactivateCheckinSession,
  type CheckinSession,
} from '@/services/checkin';
import { useAuth } from '@/contexts/AuthContext';
import type { AttendanceType } from '@/types/database';

export function QrCheckInModal({
  open,
  onClose,
  attendanceType,
  serviceDate,
  eventId,
  presentCount,
}: {
  open: boolean;
  onClose: () => void;
  attendanceType: AttendanceType;
  serviceDate: string;
  eventId?: string;
  presentCount: number;
}) {
  const { profile } = useAuth();
  const [session, setSession] = useState<CheckinSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkinUrl = session ? `${window.location.origin}/checkin/${session.token}` : null;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchActiveCheckinSession(attendanceType, serviceDate, eventId)
      .then((existing) => setSession(existing))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [open, attendanceType, serviceDate, eventId]);

  useEffect(() => {
    if (!checkinUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(checkinUrl, { width: 280, margin: 1, color: { dark: '#0F2A5F', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => toast.error('Could not generate the QR code image.'));
  }, [checkinUrl]);

  async function handleGenerate() {
    if (!profile) return;
    setLoading(true);
    try {
      const created = await createCheckinSession({
        attendance_type: attendanceType,
        service_date: serviceDate,
        event_id: eventId ?? null,
        created_by: profile.id,
      });
      setSession(created);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!session) return;
    await deactivateCheckinSession(session.id);
    setSession(null);
    toast.success('QR check-in stopped');
  }

  function copyLink() {
    if (!checkinUrl) return;
    navigator.clipboard.writeText(checkinUrl);
    toast.success('Link copied');
  }

  return (
    <Modal open={open} onClose={onClose} title="QR code check-in">
      {!session ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <QrCodeIcon className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">
            Generate a QR code for this service. Members scan it with their phone, find their name, and check
            themselves in — no login needed. Their check-in appears here instantly.
          </p>
          <Button onClick={handleGenerate} isLoading={loading}>
            Generate QR code
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          {qrDataUrl && <img src={qrDataUrl} alt="Check-in QR code" className="rounded-lg border border-slate-200" />}
          <p className="rounded-full bg-secondary-50 px-3 py-1 text-sm font-semibold text-secondary">
            {presentCount} checked in so far
          </p>
          <div className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <span className="truncate">{checkinUrl}</span>
            <button onClick={copyLink} className="shrink-0 text-secondary hover:text-secondary-700">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" onClick={handleStop}>
            <StopCircle className="h-4 w-4" /> Stop this QR session
          </Button>
        </div>
      )}
    </Modal>
  );
}
