import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, CheckCircle2, XCircle } from 'lucide-react';
import { getCheckinSessionInfo, searchCheckinMembers, submitSelfCheckIn } from '@/services/checkin';
import { Spinner } from '@/components/ui/EmptyState';
import { format } from 'date-fns';

type SessionInfo = Awaited<ReturnType<typeof getCheckinSessionInfo>>;

const TYPE_LABEL: Record<string, string> = {
  sabbath_service: 'Sabbath Service',
  midweek_service: 'Midweek Service',
  event: 'Event',
};

export function PublicCheckIn() {
  const { token } = useParams<{ token: string }>();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; first_name: string; last_name: string; member_code: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirmed, setConfirmed] = useState<{ name: string; message: string } | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getCheckinSessionInfo(token)
      .then(setSessionInfo)
      .finally(() => setLoadingSession(false));
  }, [token]);

  useEffect(() => {
    if (!token || !sessionInfo?.valid) return;
    const handle = setTimeout(() => {
      setSearching(true);
      searchCheckinMembers(token, query)
        .then(setResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [token, query, sessionInfo?.valid]);

  async function handleSelect(member: { id: string; first_name: string; last_name: string }) {
    if (!token) return;
    setSubmittingId(member.id);
    try {
      const result = await submitSelfCheckIn(token, member.id);
      if (result?.success) {
        setConfirmed({ name: `${member.first_name} ${member.last_name}`, message: result.message });
      } else {
        setConfirmed({ name: `${member.first_name} ${member.last_name}`, message: result?.message ?? 'Something went wrong.' });
      }
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/abeka.png" alt="Abeka SDA Church" className="mb-3 h-14 w-14 rounded-xl object-contain" />
          <h1 className="text-lg font-bold text-ink">Service Check-In</h1>
          <p className="text-sm text-slate-500">Abeka SDA Church</p>
        </div>

        {loadingSession ? (
          <Spinner />
        ) : !sessionInfo?.valid ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <XCircle className="h-10 w-10 text-red-400" />
            <p className="font-medium text-ink">This check-in link is no longer active</p>
            <p className="text-sm text-slate-500">Please ask a church leader for a new QR code.</p>
          </div>
        ) : confirmed ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-lg font-semibold text-ink">{confirmed.name}</p>
            <p className="text-sm text-slate-500">{confirmed.message}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-lg bg-secondary-50 px-3 py-2 text-center text-sm font-medium text-secondary">
              {TYPE_LABEL[sessionInfo.attendance_type] ?? sessionInfo.attendance_type}
              {sessionInfo.event_title && ` — ${sessionInfo.event_title}`}
              <br />
              <span className="text-xs font-normal text-secondary/80">
                {format(new Date(sessionInfo.service_date), 'EEEE, MMM d, yyyy')}
              </span>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type your name…"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
              />
            </div>

            {searching ? (
              <Spinner label="Searching…" />
            ) : results.length === 0 && query ? (
              <p className="py-4 text-center text-sm text-slate-400">No members found. Check the spelling, or ask for help.</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {results.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m)}
                    disabled={submittingId === m.id}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="font-medium text-ink">
                      {m.first_name} {m.last_name}
                    </span>
                    <span className="text-xs text-slate-400">{submittingId === m.id ? 'Checking in…' : "I'm here"}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
