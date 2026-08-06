import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus2, Search, Edit2, Trash2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { fetchRecentVisitors, updateVisitor, deleteVisitor } from '@/services/visitors';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import { useAuth } from '@/contexts/AuthContext';
import { VisitorFormModal } from '@/features/visitors/VisitorFormModal';
import { PromoteToMemberModal } from '@/features/visitors/PromoteToMemberModal';

export function Visitors() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole('administrator', 'secretary');

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promotingVisitor, setPromotingVisitor] = useState<any>(null);

  const visitorsQuery = useQuery({
    queryKey: ['visitors'],
    queryFn: () => fetchRecentVisitors(100),
  });

  useRealtimeQuery('visitors', ['visitors']);

  const visitors = visitorsQuery.data ?? [];
  const filteredVisitors = visitors.filter((v) =>
    `${v.first_name} ${v.last_name} ${v.phone_number} ${v.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const unfollowedCount = visitors.filter((v) => !v.followed_up).length;

  async function handleMarkFollowedUp(id: string) {
    try {
      await updateVisitor(id, { followed_up: true });
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['unfollowed-visitors'] });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this visitor record?')) return;
    try {
      await deleteVisitor(id);
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['unfollowed-visitors'] });
    } catch (err) {
      console.error(err);
    }
  }

  function openAdd() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Visitors</h1>
          <p className="text-sm text-slate-500">
            Track first-time visitors for follow-up and outreach.
            {unfollowedCount > 0 && (
              <span className="ml-2 font-medium text-amber-600">
                {unfollowedCount} need follow-up
              </span>
            )}
          </p>
        </div>
        {canManage && (
          <Button onClick={openAdd}>
            <UserPlus2 className="h-4 w-4" /> Add Visitor
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search visitors by name, phone, or email…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50"
        />
      </div>

      {visitorsQuery.isLoading ? (
        <Spinner />
      ) : filteredVisitors.length === 0 ? (
        <EmptyState
          icon={UserPlus2}
          title={search ? 'No visitors found' : 'No visitors yet'}
          description={search ? 'Try a different search term' : 'Add your first visitor to begin tracking'}
        />
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Visit Date</th>
                <th className="px-4 py-3">Visit Type</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisitors.map((visitor) => (
                <tr key={visitor.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-ink">
                    {visitor.first_name} {visitor.last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="text-xs">
                      {visitor.phone_number && <div>{visitor.phone_number}</div>}
                      {visitor.email && <div className="text-slate-500">{visitor.email}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {format(new Date(visitor.visit_date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {visitor.visit_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={visitor.followed_up ? 'green' : 'amber'}>
                      {visitor.followed_up ? 'Followed up' : 'Pending'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {!visitor.followed_up && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkFollowedUp(visitor.id)}
                            title="Mark as followed up"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPromotingVisitor(visitor)}
                          title="Promote to member"
                        >
                          <UserPlus2 className="h-3.5 w-3.5" /> Promote
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(visitor.id)}
                          title="Edit visitor"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <button
                          onClick={() => handleDelete(visitor.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete visitor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VisitorFormModal
        open={formOpen}
        visitorId={editingId}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          queryClient.invalidateQueries({ queryKey: ['visitors'] });
          queryClient.invalidateQueries({ queryKey: ['unfollowed-visitors'] });
        }}
      />

      {promotingVisitor && (
        <PromoteToMemberModal
          visitor={promotingVisitor}
          onClose={() => setPromotingVisitor(null)}
          onSuccess={() => {
            setPromotingVisitor(null);
            queryClient.invalidateQueries({ queryKey: ['visitors'] });
            queryClient.invalidateQueries({ queryKey: ['unfollowed-visitors'] });
            queryClient.invalidateQueries({ queryKey: ['members'] });
          }}
        />
      )}
    </div>
  );
}
