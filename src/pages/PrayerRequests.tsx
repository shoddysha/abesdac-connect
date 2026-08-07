import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HandHeart, Search, Check, Clock, Sparkles, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import {
  fetchPrayerRequests,
  updatePrayerRequest,
  deletePrayerRequest,
  type PrayerStatus,
} from '@/services/prayerRequests';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import { PrayerAnswerModal } from '@/features/prayer/PrayerAnswerModal';
import toast from 'react-hot-toast';

export function PrayerRequests() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('administrator', 'pastor', 'secretary');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PrayerStatus | 'all'>('all');
  const [answeringRequest, setAnsweringRequest] = useState<any>(null);

  const requestsQuery = useQuery({
    queryKey: ['prayer-requests'],
    queryFn: () => fetchPrayerRequests(200),
  });

  useRealtimeQuery('prayer_requests', ['prayer-requests']);

  const requests = requestsQuery.data ?? [];
  const filteredRequests = requests
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .filter((r) =>
      `${r.requested_by} ${r.request_text}`.toLowerCase().includes(search.toLowerCase())
    );

  const openCount = requests.filter((r) => r.status === 'open').length;
  const ongoingCount = requests.filter((r) => r.status === 'ongoing').length;
  const answeredCount = requests.filter((r) => r.status === 'answered').length;

  async function handleStatusChange(id: string, status: PrayerStatus) {
    try {
      await updatePrayerRequest(id, { status });
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      toast.success('Status updated');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this prayer request?')) return;
    try {
      await deletePrayerRequest(id);
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      toast.success('Prayer request deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Prayer Requests</h1>
          <p className="text-sm text-slate-500">
            Prayer requests received automatically from Google Forms.
          </p>
        </div>
        <a
          href="https://forms.google.com/your-form-url"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
        >
          <ExternalLink className="h-4 w-4" /> Open Prayer Form
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow" onClick={() => setStatusFilter('open')}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{openCount}</p>
              <p className="text-xs text-slate-500">Open Requests</p>
            </div>
          </div>
        </Card>
        <Card className="hover:shadow-md transition-shadow" onClick={() => setStatusFilter('ongoing')}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <HandHeart className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{ongoingCount}</p>
              <p className="text-xs text-slate-500">Ongoing</p>
            </div>
          </div>
        </Card>
        <Card className="hover:shadow-md transition-shadow" onClick={() => setStatusFilter('answered')}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2.5">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{answeredCount}</p>
              <p className="text-xs text-slate-500">Answered</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prayer requests…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'open' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('open')}
          >
            Open
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'ongoing' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('ongoing')}
          >
            Ongoing
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'answered' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('answered')}
          >
            Answered
          </Button>
        </div>
      </div>

      {requestsQuery.isLoading ? (
        <Spinner />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={HandHeart}
          title={search ? 'No requests found' : 'No prayer requests yet'}
          description={search ? 'Try a different search term' : 'Share the Google Form link with church members to receive prayer requests'}
        />
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      tone={
                        request.status === 'answered'
                          ? 'green'
                          : request.status === 'ongoing'
                          ? 'amber'
                          : 'blue'
                      }
                    >
                      {request.status}
                    </Badge>
                    {request.is_anonymous && (
                      <Badge tone="purple">
                        <Sparkles className="h-3 w-3" /> Anonymous
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500">
                      {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-ink mb-1">
                    {request.is_anonymous ? 'Anonymous' : request.requested_by}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{request.request_text}</p>
                  {request.answer_notes && (
                    <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
                      <p className="text-xs font-medium text-green-900 mb-1">
                        Answered {request.answered_at && `on ${format(new Date(request.answered_at), 'MMM d, yyyy')}`}
                      </p>
                      <p className="text-sm text-green-800">{request.answer_notes}</p>
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    {request.status !== 'answered' && (
                      <>
                        {request.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(request.id, 'ongoing')}
                            title="Mark as ongoing"
                          >
                            <HandHeart className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAnsweringRequest(request)}
                          title="Mark as answered"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {hasRole('administrator') && (
                      <button
                        onClick={() => handleDelete(request.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {answeringRequest && (
        <PrayerAnswerModal
          request={answeringRequest}
          onClose={() => setAnsweringRequest(null)}
          onSaved={() => {
            setAnsweringRequest(null);
            queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
          }}
        />
      )}
    </div>
  );
}
