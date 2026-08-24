import { supabase } from '@/lib/supabase';
import type { MinistryReport, ReportType } from '@/types/database';

export interface MinistryReportWithDetails extends MinistryReport {
  ministry_name?: string;
  submitter_name?: string;
}

export interface CreateReportInput {
  ministry_id: string;
  report_period: string;
  report_type?: ReportType;
  title: string;
  summary?: string;
  achievements?: string;
  challenges?: string;
  attendance_count?: number;
  expenses?: number;
  future_plans?: string;
}

export interface UpdateReportInput {
  report_period?: string;
  report_type?: ReportType;
  title?: string;
  summary?: string;
  achievements?: string;
  challenges?: string;
  attendance_count?: number;
  expenses?: number;
  future_plans?: string;
}

/**
 * Fetch all reports for a ministry
 */
export async function fetchMinistryReports(ministryId: string): Promise<MinistryReportWithDetails[]> {
  const { data, error } = await supabase
    .from('ministry_reports')
    .select(`
      *,
      ministries(name),
      profiles(full_name)
    `)
    .eq('ministry_id', ministryId)
    .order('report_period', { ascending: false });

  if (error) throw error;

  return (data || []).map((report: any) => ({
    ...report,
    ministry_name: report.ministries?.name,
    submitter_name: report.profiles?.full_name,
  }));
}

/**
 * Fetch all reports (for admin/secretary)
 */
export async function fetchAllMinistryReports(): Promise<MinistryReportWithDetails[]> {
  const { data, error } = await supabase
    .from('ministry_reports')
    .select(`
      *,
      ministries(name),
      profiles(full_name)
    `)
    .order('report_period', { ascending: false });

  if (error) throw error;

  return (data || []).map((report: any) => ({
    ...report,
    ministry_name: report.ministries?.name,
    submitter_name: report.profiles?.full_name,
  }));
}

/**
 * Create a new report
 */
export async function createMinistryReport(input: CreateReportInput, submittedBy: string): Promise<MinistryReport> {
  const { data, error } = await supabase
    .from('ministry_reports')
    .insert({
      ministry_id: input.ministry_id,
      report_period: input.report_period,
      report_type: input.report_type || 'monthly',
      title: input.title,
      summary: input.summary || null,
      achievements: input.achievements || null,
      challenges: input.challenges || null,
      attendance_count: input.attendance_count || null,
      expenses: input.expenses || null,
      future_plans: input.future_plans || null,
      submitted_by: submittedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a report
 */
export async function updateMinistryReport(id: string, updates: UpdateReportInput): Promise<void> {
  const { error } = await supabase
    .from('ministry_reports')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

/** Acknowledge a report (admin/secretary only) */
export async function acknowledgeMinistryReport(
  id: string,
  acknowledgedBy: string,
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from('ministry_reports')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: acknowledgedBy,
      acknowledgement_note: note || null,
    })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Delete a report (all roles allowed)
 */
export async function deleteMinistryReport(id: string): Promise<void> {
  const { error } = await supabase
    .from('ministry_reports')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get report periods for a ministry (for dropdown selection)
 */
export function generateReportPeriods(type: ReportType): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const periods: string[] = [];
  
  if (type === 'monthly') {
    // Last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      periods.push(period);
    }
  } else if (type === 'quarterly') {
    // Last 8 quarters
    const currentQuarter = Math.ceil(currentMonth / 3);
    for (let i = 0; i < 8; i++) {
      const quarterOffset = currentQuarter - i;
      const year = currentYear + Math.floor((quarterOffset - 1) / 4);
      const quarter = ((quarterOffset - 1) % 4 + 4) % 4 + 1;
      periods.push(`Q${quarter} ${year}`);
    }
  } else if (type === 'annual') {
    // Last 5 years
    for (let i = 0; i < 5; i++) {
      periods.push(`${currentYear - i}`);
    }
  }
  
  return periods;
}
