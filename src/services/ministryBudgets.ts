import { supabase } from '@/lib/supabase';
import type { MinistryBudget, MinistryBudgetItem, BudgetStatus, BudgetPeriodType } from '@/types/database';
import { logAudit } from './audit';

export interface MinistryBudgetWithDetails extends MinistryBudget {
  ministry_name?: string;
  submitter_name?: string;
  reviewer_name?: string;
  items?: MinistryBudgetItem[];
}

export interface BudgetItemInput {
  item_name: string;
  description?: string;
  quantity: number;
  unit_cost: number;
  category?: string;
  priority?: string;
}

export interface CreateBudgetInput {
  ministry_id: string;
  title: string;
  description?: string;
  budget_period: string;
  period_type: BudgetPeriodType;
  event_id?: string;
  items: BudgetItemInput[];
}

/**
 * Fetch all budgets for a ministry
 */
export async function fetchMinistryBudgets(ministryId: string): Promise<MinistryBudgetWithDetails[]> {
  const { data, error } = await supabase
    .from('ministry_budgets')
    .select(`
      *,
      ministries(name),
      submitter:profiles!ministry_budgets_submitted_by_fkey(full_name),
      reviewer:profiles!ministry_budgets_reviewed_by_fkey(full_name)
    `)
    .eq('ministry_id', ministryId)
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((budget: any) => ({
    ...budget,
    ministry_name: budget.ministries?.name,
    submitter_name: budget.submitter?.full_name,
    reviewer_name: budget.reviewer?.full_name,
  }));
}

/**
 * Fetch all budgets (for admin/secretary)
 */
export async function fetchAllMinistryBudgets(): Promise<MinistryBudgetWithDetails[]> {
  const { data, error } = await supabase
    .from('ministry_budgets')
    .select(`
      *,
      ministries(name),
      submitter:profiles!ministry_budgets_submitted_by_fkey(full_name),
      reviewer:profiles!ministry_budgets_reviewed_by_fkey(full_name)
    `)
    .order('submitted_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((budget: any) => ({
    ...budget,
    ministry_name: budget.ministries?.name,
    submitter_name: budget.submitter?.full_name,
    reviewer_name: budget.reviewer?.full_name,
  }));
}

/**
 * Fetch budget with items
 */
export async function fetchBudgetWithItems(budgetId: string): Promise<MinistryBudgetWithDetails> {
  const [budgetResponse, itemsResponse] = await Promise.all([
    supabase
      .from('ministry_budgets')
      .select(`
        *,
        ministries(name),
        submitter:profiles!ministry_budgets_submitted_by_fkey(full_name),
        reviewer:profiles!ministry_budgets_reviewed_by_fkey(full_name)
      `)
      .eq('id', budgetId)
      .single(),
    supabase
      .from('ministry_budget_items')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: true }),
  ]);

  if (budgetResponse.error) throw budgetResponse.error;
  if (itemsResponse.error) throw itemsResponse.error;

  const budget = budgetResponse.data;

  return {
    ...budget,
    ministry_name: budget.ministries?.name,
    submitter_name: budget.submitter?.full_name,
    reviewer_name: budget.reviewer?.full_name,
    items: itemsResponse.data || [],
  };
}

/**
 * Create a new budget with items
 */
export async function createMinistryBudget(input: CreateBudgetInput, submittedBy: string): Promise<string> {
  // Get user profile for audit log
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', submittedBy)
    .single();

  // Get ministry name for audit log
  const { data: ministry } = await supabase
    .from('ministries')
    .select('name')
    .eq('id', input.ministry_id)
    .single();

  // Create the budget
  const { data: budget, error: budgetError } = await supabase
    .from('ministry_budgets')
    .insert({
      ministry_id: input.ministry_id,
      title: input.title,
      description: input.description || null,
      budget_period: input.budget_period,
      period_type: input.period_type,
      event_id: input.event_id || null,
      submitted_by: submittedBy,
      status: 'pending',
    })
    .select('id')
    .single();

  if (budgetError) throw budgetError;

  // Create the budget items
  if (input.items.length > 0) {
    const items = input.items.map((item) => ({
      budget_id: budget.id,
      item_name: item.item_name,
      description: item.description || null,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      category: item.category || null,
      priority: item.priority || null,
    }));

    const { error: itemsError } = await supabase
      .from('ministry_budget_items')
      .insert(items);

    if (itemsError) throw itemsError;
  }

  // Log audit
  await logAudit(
    'create',
    'ministry_budgets',
    `${profile?.full_name || 'User'} submitted budget "${input.title}" for ${ministry?.name || 'ministry'}`,
    budget.id,
    submittedBy,
    profile?.full_name
  );

  return budget.id;
}

/**
 * Delete a budget (and its items via CASCADE)
 */
export async function deleteMinistryBudget(id: string): Promise<void> {
  // Get budget details for audit log
  const { data: budget } = await supabase
    .from('ministry_budgets')
    .select('title, ministries(name), submitter:profiles!ministry_budgets_submitted_by_fkey(id, full_name)')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('ministry_budgets')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Log audit
  if (budget) {
    await logAudit(
      'delete',
      'ministry_budgets',
      `Budget "${budget.title}" from ${(budget as any).ministries?.name || 'ministry'} was deleted`,
      id,
      (budget as any).submitter?.id,
      (budget as any).submitter?.full_name
    );
  }
}

/**
 * Update budget status (approve/reject)
 */
export async function updateBudgetStatus(
  id: string,
  status: BudgetStatus,
  reviewedBy: string,
  reviewNote?: string
): Promise<void> {
  // Get reviewer, budget details, and ministry leader info for notifications
  const [reviewerResponse, budgetResponse, ministryResponse] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', reviewedBy).single(),
    supabase
      .from('ministry_budgets')
      .select('title, ministry_id, total_amount, ministries(name), submitter:profiles!ministry_budgets_submitted_by_fkey(full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('ministry_budgets')
      .select('ministry_id, ministries!inner(id, leaders:ministry_leaders!inner(member_id, members!inner(first_name, last_name, phone)))')
      .eq('id', id)
      .single(),
  ]);

  const { error } = await supabase
    .from('ministry_budgets')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    })
    .eq('id', id);

  if (error) throw error;

  // Log audit
  if (reviewerResponse.data && budgetResponse.data) {
    const budget = budgetResponse.data as any;
    await logAudit(
      'update',
      'ministry_budgets',
      `${reviewerResponse.data.full_name} ${status} budget "${budget.title}" from ${budget.ministries?.name || 'ministry'}${reviewNote ? ` - Note: ${reviewNote}` : ''}`,
      id,
      reviewedBy,
      reviewerResponse.data.full_name
    );
  }

  // Send budget approval/rejection notification to ministry leaders immediately
  if (budgetResponse.data && ministryResponse.data && (status === 'approved' || status === 'rejected')) {
    try {
      const budget = budgetResponse.data as any;
      const ministry = ministryResponse.data as any;
      const leaders = ministry.ministries?.leaders || [];

      const { queueBudgetApprovalNotification, processPendingNotifications } = await import('./notifications');
      
      // Queue notifications for all ministry leaders with phone numbers
      for (const leader of leaders) {
        const member = leader.members;
        if (member?.phone) {
          await queueBudgetApprovalNotification(
            id,
            member.id,
            `${member.first_name} ${member.last_name}`,
            member.phone,
            budget.title,
            status,
            reviewNote || ''
          );
        }
      }
      
      // Process immediately (don't wait for scheduler)
      await processPendingNotifications();
    } catch (err) {
      console.error('Failed to send budget approval notification:', err);
      // Don't throw - status update was successful
    }
  }
}

/**
 * Generate budget periods
 */
export function generateBudgetPeriods(type: BudgetPeriodType): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const periods: string[] = [];
  
  if (type === 'monthly') {
    // Next 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, currentMonth - 1 + i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      periods.push(period);
    }
  } else if (type === 'quarterly') {
    // Next 8 quarters
    const currentQuarter = Math.ceil(currentMonth / 3);
    for (let i = 0; i < 8; i++) {
      const quarterOffset = currentQuarter + i;
      const year = currentYear + Math.floor((quarterOffset - 1) / 4);
      const quarter = ((quarterOffset - 1) % 4) + 1;
      periods.push(`Q${quarter} ${year}`);
    }
  } else if (type === 'annual') {
    // Next 3 years
    for (let i = 0; i < 3; i++) {
      periods.push(`${currentYear + i}`);
    }
  }
  
  return periods;
}
