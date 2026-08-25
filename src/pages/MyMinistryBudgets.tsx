import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Eye, ArrowLeft, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Spinner } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchMinistryBudgets,
  fetchBudgetWithItems,
  type MinistryBudgetWithDetails,
} from '@/services/ministryBudgets';
import { fetchMinistries } from '@/services/ministries';
import { format } from 'date-fns';

type BudgetStatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'allocated';

export function MyMinistryBudgets() {
  const { profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<BudgetStatusFilter>('all');
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);

  const canView = hasRole('ministry_leader');

  // Fetch user's ministry
  const ministriesQuery = useQuery({
    queryKey: ['ministries'],
    queryFn: fetchMinistries,
  });

  const userMinistry = ministriesQuery.data?.find((m) => m.leader_id === profile?.id);

  // Fetch budgets for this ministry
  const budgetsQuery = useQuery({
    queryKey: ['ministry-budgets', userMinistry?.id],
    queryFn: () => fetchMinistryBudgets(userMinistry!.id),
    enabled: !!userMinistry,
  });

  // Fetch selected budget details
  const budgetDetailsQuery = useQuery({
    queryKey: ['ministry-budget', selectedBudget],
    queryFn: () => fetchBudgetWithItems(selectedBudget!),
    enabled: !!selectedBudget,
  });

  const budgets = budgetsQuery.data || [];
  const filteredBudgets = statusFilter === 'all' 
    ? budgets 
    : budgets.filter((b) => b.status === statusFilter);

  if (!canView) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">My Ministry Budgets</h1>
        <EmptyState
          icon={DollarSign}
          title="Access Denied"
          description="Only ministry leaders can view budgets"
        />
      </div>
    );
  }

  if (ministriesQuery.isLoading || budgetsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-ink">My Ministry Budgets</h1>
        <Spinner />
      </div>
    );
  }

  if (!userMinistry) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ministry-dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-ink">My Ministry Budgets</h1>
        </div>
        <EmptyState
          icon={DollarSign}
          title="No ministry assigned"
          description="Contact an administrator to assign you as a ministry leader"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ministry-dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-ink">My Ministry Budgets</h1>
            <p className="text-sm text-slate-500 mt-1">{userMinistry.name}</p>
          </div>
        </div>
        <Button onClick={() => navigate('/submit-ministry-budget')}>
          <DollarSign className="h-4 w-4" />
          Submit New Budget
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total Budgets</p>
          <p className="text-2xl font-bold text-ink">{budgets.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600">
            {budgets.filter((b) => b.status === 'pending').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Approved</p>
          <p className="text-2xl font-bold text-green-600">
            {budgets.filter((b) => b.status === 'approved').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">
            {budgets.filter((b) => b.status === 'rejected').length}
          </p>
        </Card>
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
              ? 'You haven\'t submitted any budgets yet'
              : `No ${statusFilter} budgets found`
          }
          action={
            statusFilter === 'all' ? (
              <Button onClick={() => navigate('/submit-ministry-budget')}>
                <DollarSign className="h-4 w-4" />
                Submit Your First Budget
              </Button>
            ) : undefined
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
                      <div className="flex items-center gap-2 mt-1">
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
                        <span className="text-sm text-slate-500 capitalize">
                          {budget.period_type} • {budget.budget_period}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total Amount</p>
                      <p className="text-2xl font-bold text-primary">
                        GH₵{Number(budget.total_amount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {budget.description && (
                    <p className="text-sm text-slate-600">{budget.description}</p>
                  )}

                  {/* Review Status */}
                  {budget.reviewed_at && (
                    <div className={`p-3 rounded-lg border ${
                      budget.status === 'approved'
                        ? 'bg-green-50 border-green-200'
                        : budget.status === 'rejected'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {budget.status === 'approved' ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        ) : budget.status === 'rejected' ? (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        ) : (
                          <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${
                            budget.status === 'approved'
                              ? 'text-green-800'
                              : budget.status === 'rejected'
                              ? 'text-red-800'
                              : 'text-blue-800'
                          }`}>
                            {budget.status === 'approved' ? 'Budget Approved' : budget.status === 'rejected' ? 'Budget Rejected' : 'Budget Allocated'}
                          </p>
                          <p className={`text-xs ${
                            budget.status === 'approved'
                              ? 'text-green-700'
                              : budget.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-blue-700'
                          }`}>
                            Reviewed on {format(new Date(budget.reviewed_at), 'MMM d, yyyy h:mm a')}
                            {budget.reviewer_name && ` by ${budget.reviewer_name}`}
                          </p>
                          {budget.review_note && (
                            <p className={`text-sm mt-2 ${
                              budget.status === 'approved'
                                ? 'text-green-700'
                                : budget.status === 'rejected'
                                ? 'text-red-700'
                                : 'text-blue-700'
                            }`}>
                              <span className="font-medium">Note:</span> {budget.review_note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending Status */}
                  {budget.status === 'pending' && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-2">
                        <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">
                            Awaiting Review
                          </p>
                          <p className="text-xs text-amber-700">
                            Your budget is being reviewed by the admin or secretary
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-2 pt-2 border-t text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
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
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Budget Details Modal */}
      <Modal
        open={!!selectedBudget}
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

            {budgetDetailsQuery.data.description && (
              <div className="pb-4 border-b">
                <p className="text-sm text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700">{budgetDetailsQuery.data.description}</p>
              </div>
            )}

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

            {budgetDetailsQuery.data.reviewed_at && (
              <div className={`p-4 rounded-lg border ${
                budgetDetailsQuery.data.status === 'approved'
                  ? 'bg-green-50 border-green-200'
                  : budgetDetailsQuery.data.status === 'rejected'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <p className={`text-sm font-semibold mb-1 ${
                  budgetDetailsQuery.data.status === 'approved'
                    ? 'text-green-800'
                    : budgetDetailsQuery.data.status === 'rejected'
                    ? 'text-red-800'
                    : 'text-blue-800'
                }`}>
                  Review Status
                </p>
                <p className={`text-xs ${
                  budgetDetailsQuery.data.status === 'approved'
                    ? 'text-green-700'
                    : budgetDetailsQuery.data.status === 'rejected'
                    ? 'text-red-700'
                    : 'text-blue-700'
                }`}>
                  Reviewed on {format(new Date(budgetDetailsQuery.data.reviewed_at), 'MMM d, yyyy h:mm a')}
                  {budgetDetailsQuery.data.reviewer_name && ` by ${budgetDetailsQuery.data.reviewer_name}`}
                </p>
                {budgetDetailsQuery.data.review_note && (
                  <p className={`text-sm mt-2 ${
                    budgetDetailsQuery.data.status === 'approved'
                      ? 'text-green-700'
                      : budgetDetailsQuery.data.status === 'rejected'
                      ? 'text-red-700'
                      : 'text-blue-700'
                  }`}>
                    <span className="font-medium">Note:</span> {budgetDetailsQuery.data.review_note}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
