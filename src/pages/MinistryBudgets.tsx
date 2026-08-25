import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DollarSign, CheckCircle, XCircle, Eye, Trash2, Clock, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Spinner } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAllMinistryBudgets,
  fetchBudgetWithItems,
  updateBudgetStatus,
  deleteMinistryBudget,
  type MinistryBudgetWithDetails,
} from '@/services/ministryBudgets';
import { format } from 'date-fns';

type BudgetStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'allocated';

export function MinistryBudgets() {
  const { profile, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<BudgetStatusFilter>('all');
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const canManage = hasRole('administrator', 'secretary');

  // Fetch all budgets
  const budgetsQuery = useQuery({
    queryKey: ['ministry-budgets-all'],
    queryFn: fetchAllMinistryBudgets,
    enabled: canManage,
  });

  // Fetch selected budget details
  const budgetDetailsQuery = useQuery({
    queryKey: ['ministry-budget', selectedBudget],
    queryFn: () => fetchBudgetWithItems(selectedBudget!),
    enabled: !!selectedBudget,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMinistryBudget,
    onSuccess: () => {
      toast.success('Budget deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['ministry-budgets-all'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      note?: string;
    }) => {
      await updateBudgetStatus(id, status, profile!.id, note);
    },
    onSuccess: () => {
      toast.success('Budget reviewed successfully');
      queryClient.invalidateQueries({ queryKey: ['ministry-budgets-all'] });
      queryClient.invalidateQueries({ queryKey: ['ministry-budget', selectedBudget] });
      setReviewAction(null);
      setReviewNote('');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const budgets = budgetsQuery.data || [];
  const filteredBudgets = statusFilter === 'all' 
    ? budgets 
    : budgets.filter((b) => b.status === statusFilter);

  function handleDelete(id: string, title: string) {
    if (confirm(`Delete budget "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  }

  function handleReview() {
    if (!selectedBudget || !reviewAction || !profile) return;
    reviewMutation.mutate({
      id: selectedBudget,
      status: reviewAction === 'approve' ? 'approved' : 'rejected',
      note: reviewNote,
    });
  }

  if (!canManage) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Ministry Budgets</h1>
        <EmptyState
          icon={DollarSign}
          title="Access Denied"
          description="Only administrators and secretaries can view ministry budgets"
        />
      </div>
    );
  }

  if (budgetsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">Ministry Budgets</h1>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ministry Budgets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and manage budget requests from ministry leaders
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'pending', 'approved', 'rejected', 'allocated'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === status
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-2 text-xs">
              ({status === 'all' ? budgets.length : budgets.filter((b) => b.status === status).length})
            </span>
          </button>
        ))}
      </div>

      {/* Budgets List */}
      {filteredBudgets.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No budgets found"
          description={
            statusFilter === 'all'
              ? 'No budget requests have been submitted yet'
              : `No ${statusFilter} budgets found`
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredBudgets.map((budget) => (
            <Card key={budget.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-ink">{budget.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{budget.ministry_name}</p>
                    </div>
                    <Badge
                      tone={
                        budget.status === 'approved'
                          ? 'green'
                          : budget.status === 'rejected'
                          ? 'red'
                          : budget.status === 'allocated'
                          ? 'blue'
                          : 'amber'
                      }
                    >
                      {budget.status}
                    </Badge>
                  </div>

                  {/* Budget Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Period Type</p>
                      <p className="font-medium text-ink capitalize">{budget.period_type}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Budget Period</p>
                      <p className="font-medium text-ink">{budget.budget_period}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Total Amount</p>
                      <p className="font-semibold text-primary text-lg">
                        GH₵{Number(budget.total_amount).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Submitted By</p>
                      <p className="font-medium text-ink">{budget.submitter_name || 'Unknown'}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {budget.description && (
                    <p className="text-sm text-slate-600">{budget.description}</p>
                  )}

                  {/* Review Info */}
                  {budget.reviewed_at && (
                    <div className="text-xs text-slate-500 border-t pt-2">
                      <p>
                        Reviewed by {budget.reviewer_name} on{' '}
                        {format(new Date(budget.reviewed_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      {budget.review_note && (
                        <p className="mt-1 text-slate-600">Note: {budget.review_note}</p>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-2 pt-2 border-t text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>Submitted {format(new Date(budget.submitted_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedBudget(budget.id)}
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Button>

                  {budget.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedBudget(budget.id);
                          setReviewAction('approve');
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBudget(budget.id);
                          setReviewAction('reject');
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(budget.id, budget.title)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Budget Details Modal */}
      <Modal
        open={!!selectedBudget && !reviewAction}
        onClose={() => setSelectedBudget(null)}
        title="Budget Details"
        size="lg"
      >
        {budgetDetailsQuery.isLoading ? (
          <Spinner />
        ) : budgetDetailsQuery.data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b">
              <div>
                <p className="text-sm text-slate-500">Ministry</p>
                <p className="font-medium">{budgetDetailsQuery.data.ministry_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <Badge
                  tone={
                    budgetDetailsQuery.data.status === 'approved'
                      ? 'green'
                      : budgetDetailsQuery.data.status === 'rejected'
                      ? 'red'
                      : 'amber'
                  }
                >
                  {budgetDetailsQuery.data.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-500">Period Type</p>
                <p className="font-medium capitalize">{budgetDetailsQuery.data.period_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Budget Period</p>
                <p className="font-medium">{budgetDetailsQuery.data.budget_period}</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-ink mb-3">Budget Items</h4>
              <div className="space-y-2">
                {budgetDetailsQuery.data.items?.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-ink">{item.item_name}</p>
                        {item.description && (
                          <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          {item.category && (
                            <span className="capitalize">Category: {item.category}</span>
                          )}
                          {item.priority && (
                            <span className="capitalize">Priority: {item.priority}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">
                          {item.quantity} × GH₵{Number(item.unit_cost).toFixed(2)}
                        </p>
                        <p className="font-semibold text-primary">
                          GH₵{Number(item.total_cost).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t flex items-center justify-between">
              <p className="text-lg font-semibold text-ink">Total Budget</p>
              <p className="text-2xl font-bold text-primary">
                GH₵{Number(budgetDetailsQuery.data.total_amount).toFixed(2)}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Review Modal */}
      <Modal
        open={!!reviewAction}
        onClose={() => {
          setReviewAction(null);
          setReviewNote('');
        }}
        title={`${reviewAction === 'approve' ? 'Approve' : 'Reject'} Budget`}
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to {reviewAction} this budget request?
          </p>

          <Textarea
            label={`Review Note (Optional)`}
            placeholder={`Add a note about your ${reviewAction} decision...`}
            rows={3}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setReviewAction(null);
                setReviewNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'approve' ? 'primary' : 'danger'}
              onClick={handleReview}
              isLoading={reviewMutation.isPending}
            >
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Budget
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
