import { supabase } from '@/lib/supabase';
import type { MinistryBudget, MinistryBudgetItem, BudgetStatus, BudgetPeriodType } from '@/types/database';

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

  return budget.id;
}

/**
 * Delete a budget (and its items via CASCADE)
 */
export async function deleteMinistryBudget(id: string): Promise<void> {
  const { error } = await supabase
    .from('ministry_budgets')
    .delete()
    .eq('id', id);

  if (error) throw error;
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
