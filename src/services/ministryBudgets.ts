import { supabase } from '@/lib/supabase';
import type { MinistryBudget, BudgetLineItem, BudgetType } from '@/types/database';

export interface MinistryBudgetWithDetails extends MinistryBudget {
  ministry_name?: string;
  submitter_name?: string;
}

export interface CreateBudgetInput {
  ministry_id: string;
  title: string;
  budget_type: BudgetType;
  period: string;
  description?: string;
  line_items: BudgetLineItem[];
}

export interface UpdateBudgetInput {
  title?: string;
  budget_type?: BudgetType;
  period?: string;
  description?: string;
  line_items?: BudgetLineItem[];
  total_amount?: number;
  status?: 'draft' | 'submitted';
  submitted_at?: string | null;
}

/** Compute total from line items */
export function computeTotal(lineItems: BudgetLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/** Fetch all budgets for a specific ministry (ministry leader view) */
export async function fetchMinistryBudgets(ministryId: string): Promise<MinistryBudgetWithDetails[]> {
  console.log('Fetching ministry budgets for ministry:', ministryId);
  
  const { data, error } = await supabase
    .from('ministry_budgets')
    .select('*, ministries(name), profiles(full_name)')
    .eq('ministry_id', ministryId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching ministry budgets:', error);
    throw error;
  }
  
  console.log('Fetched ministry budgets:', data?.length || 0, 'budgets', data);
  
  return (data || []).map((b: any) => ({
    ...b,
    ministry_name: b.ministries?.name,
    submitter_name: b.profiles?.full_name,
  }));
}

/** Fetch all submitted budgets across every ministry (admin/secretary view) */
export async function fetchAllMinistryBudgets(): Promise<MinistryBudgetWithDetails[]> {
  const { data, error } = await supabase
    .from('ministry_budgets')
    .select('*, ministries(name), profiles(full_name)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((b: any) => ({
    ...b,
    ministry_name: b.ministries?.name,
    submitter_name: b.profiles?.full_name,
  }));
}

/** Create a new budget (always starts as draft) */
export async function createMinistryBudget(
  input: CreateBudgetInput,
  submittedBy: string,
): Promise<MinistryBudget> {
  const total = computeTotal(input.line_items);
  const { data, error } = await supabase
    .from('ministry_budgets')
    .insert({
      ministry_id: input.ministry_id,
      title: input.title,
      budget_type: input.budget_type,
      period: input.period,
      description: input.description || null,
      line_items: input.line_items,
      total_amount: total,
      status: 'draft',
      submitted_by: submittedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MinistryBudget;
}

/** Update an existing budget */
export async function updateMinistryBudget(id: string, updates: UpdateBudgetInput): Promise<void> {
  const patch: any = { ...updates };
  if (updates.line_items) {
    patch.total_amount = computeTotal(updates.line_items);
  }
  const { error } = await supabase.from('ministry_budgets').update(patch).eq('id', id);
  if (error) throw error;
}

/** Submit a budget (change status draft → submitted) */
export async function submitMinistryBudget(id: string): Promise<void> {
  const { error } = await supabase
    .from('ministry_budgets')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Delete a budget */
export async function deleteMinistryBudget(id: string): Promise<void> {
  const { error } = await supabase.from('ministry_budgets').delete().eq('id', id);
  if (error) throw error;
}
