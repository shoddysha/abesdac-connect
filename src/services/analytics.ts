import { supabase } from '@/lib/supabase';
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  format, 
  differenceInDays,
  startOfYear,
  eachMonthOfInterval,
  parseISO
} from 'date-fns';

/**
 * Get membership growth over time
 */
export async function getMembershipGrowth(months: number = 12) {
  const endDate = new Date();
  const startDate = subMonths(endDate, months);

  const { data: members, error } = await supabase
    .from('members')
    .select('date_joined, status')
    .gte('date_joined', format(startDate, 'yyyy-MM-dd'))
    .order('date_joined', { ascending: true });

  if (error) throw error;

  // Group by month
  const monthlyData: Record<string, { joined: number; total: number }> = {};
  
  // Initialize all months
  const monthsArray = eachMonthOfInterval({ start: startDate, end: endDate });
  monthsArray.forEach(month => {
    const key = format(month, 'MMM yyyy');
    monthlyData[key] = { joined: 0, total: 0 };
  });

  // Count new members per month
  (members || []).forEach(member => {
    const monthKey = format(new Date(member.date_joined), 'MMM yyyy');
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].joined++;
    }
  });

  // Calculate cumulative total
  let runningTotal = 0;
  return Object.entries(monthlyData).map(([month, data]) => {
    runningTotal += data.joined;
    return {
      month,
      joined: data.joined,
      total: runningTotal,
    };
  });
}

/**
 * Get attendance patterns by service type and period
 */
export async function getAttendancePatterns(startDate: Date, endDate: Date) {
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('service_date, attendance_type')
    .gte('service_date', format(startDate, 'yyyy-MM-dd'))
    .lte('service_date', format(endDate, 'yyyy-MM-dd'))
    .order('service_date', { ascending: true });

  if (error) throw error;

  // Group by week and service type
  const weeklyData: Record<string, Record<string, number>> = {};
  
  (attendance || []).forEach(record => {
    const weekKey = format(new Date(record.service_date), 'MMM dd, yyyy');
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        sabbath_service: 0,
        midweek_service: 0,
        event: 0,
      };
    }
    weeklyData[weekKey][record.attendance_type]++;
  });

  return Object.entries(weeklyData).map(([date, counts]) => ({
    date,
    sabbath: counts.sabbath_service,
    midweek: counts.midweek_service,
    event: counts.event,
    total: counts.sabbath_service + counts.midweek_service + counts.event,
  }));
}

/**
 * Get average attendance by service type
 */
export async function getAverageAttendanceByType(months: number = 3) {
  const endDate = new Date();
  const startDate = subMonths(endDate, months);

  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('attendance_type')
    .gte('service_date', format(startDate, 'yyyy-MM-dd'))
    .lte('service_date', format(endDate, 'yyyy-MM-dd'));

  if (error) throw error;

  const typeCounts: Record<string, number> = {
    sabbath_service: 0,
    midweek_service: 0,
    event: 0,
  };

  (attendance || []).forEach(record => {
    typeCounts[record.attendance_type]++;
  });

  // Calculate number of weeks in period
  const weeks = Math.ceil(differenceInDays(endDate, startDate) / 7);

  return [
    { type: 'Sabbath Service', average: Math.round(typeCounts.sabbath_service / weeks) },
    { type: 'Midweek Service', average: Math.round(typeCounts.midweek_service / weeks) },
    { type: 'Events', average: Math.round(typeCounts.event / weeks) },
  ];
}

/**
 * Get visitor conversion funnel
 */
export async function getVisitorConversionFunnel() {
  // Get all visitors
  const { data: visitors, error: visitorsError } = await supabase
    .from('visitors')
    .select('id, visit_date, followed_up');

  if (visitorsError) throw visitorsError;

  // Get members who were visitors (assuming we track this somehow)
  // For now, we'll use a simplified approach based on date_joined proximity to visit_date
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, date_joined, first_name, last_name')
    .order('date_joined', { ascending: false });

  if (membersError) throw membersError;

  const totalVisitors = (visitors || []).length;
  const followedUp = (visitors || []).filter(v => v.followed_up).length;
  
  // Estimate returning visitors (those visited in last 6 months)
  const sixMonthsAgo = subMonths(new Date(), 6);
  const recentVisitors = (visitors || []).filter(v => 
    new Date(v.visit_date) >= sixMonthsAgo
  ).length;

  // Estimate conversions (new members in last 6 months)
  const newMembers = (members || []).filter(m => 
    new Date(m.date_joined) >= sixMonthsAgo
  ).length;

  return [
    { stage: 'First-time Visitors', count: totalVisitors, percentage: 100 },
    { stage: 'Followed Up', count: followedUp, percentage: totalVisitors > 0 ? Math.round((followedUp / totalVisitors) * 100) : 0 },
    { stage: 'Returning Visitors', count: recentVisitors, percentage: totalVisitors > 0 ? Math.round((recentVisitors / totalVisitors) * 100) : 0 },
    { stage: 'New Members', count: newMembers, percentage: totalVisitors > 0 ? Math.round((newMembers / totalVisitors) * 100) : 0 },
  ];
}

/**
 * Get demographic breakdown
 */
export async function getDemographics() {
  const { data: members, error } = await supabase
    .from('members')
    .select('gender, date_of_birth, marital_status, district, status')
    .eq('status', 'active');

  if (error) throw error;

  // Age groups
  const ageGroups: Record<string, number> = {
    'Under 13': 0,
    '13-17': 0,
    '18-29': 0,
    '30-49': 0,
    '50-64': 0,
    '65+': 0,
    'Unknown': 0,
  };

  // Gender
  const genderCounts: Record<string, number> = {
    male: 0,
    female: 0,
    unknown: 0,
  };

  // Marital status
  const maritalCounts: Record<string, number> = {
    single: 0,
    married: 0,
    divorced: 0,
    widowed: 0,
    unknown: 0,
  };

  // District
  const districtCounts: Record<string, number> = {};

  (members || []).forEach(member => {
    // Age
    if (member.date_of_birth) {
      const age = Math.floor(
        (Date.now() - new Date(member.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (age < 13) ageGroups['Under 13']++;
      else if (age < 18) ageGroups['13-17']++;
      else if (age < 30) ageGroups['18-29']++;
      else if (age < 50) ageGroups['30-49']++;
      else if (age < 65) ageGroups['50-64']++;
      else ageGroups['65+']++;
    } else {
      ageGroups['Unknown']++;
    }

    // Gender
    if (member.gender) {
      genderCounts[member.gender]++;
    } else {
      genderCounts.unknown++;
    }

    // Marital status
    if (member.marital_status) {
      maritalCounts[member.marital_status]++;
    } else {
      maritalCounts.unknown++;
    }

    // District
    const district = member.district || 'Not specified';
    districtCounts[district] = (districtCounts[district] || 0) + 1;
  });

  return {
    ageGroups: Object.entries(ageGroups).map(([name, value]) => ({ name, value })),
    gender: Object.entries(genderCounts).map(([name, value]) => ({ name, value })),
    maritalStatus: Object.entries(maritalCounts).map(([name, value]) => ({ name, value })),
    districts: Object.entries(districtCounts).map(([name, value]) => ({ name, value })),
  };
}

/**
 * Get ministry performance metrics
 */
export async function getMinistryMetrics() {
  const { data: ministries, error: ministriesError } = await supabase
    .from('ministries')
    .select('id, name, is_active');

  if (ministriesError) throw ministriesError;

  const metrics = await Promise.all(
    (ministries || []).map(async (ministry) => {
      // Get member count
      const { count: memberCount } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministry.id)
        .eq('status', 'active');

      // Get reports submitted (last 6 months)
      const sixMonthsAgo = subMonths(new Date(), 6);
      const { count: reportCount } = await supabase
        .from('ministry_reports')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministry.id)
        .gte('submitted_at', sixMonthsAgo.toISOString());

      // Get budgets submitted (last year)
      const oneYearAgo = subMonths(new Date(), 12);
      const { count: budgetCount } = await supabase
        .from('ministry_budgets')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministry.id)
        .gte('submitted_at', oneYearAgo.toISOString());

      // Get events hosted (last 6 months)
      const { count: eventCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', sixMonthsAgo.toISOString());

      return {
        ministry_id: ministry.id,
        ministry_name: ministry.name,
        member_count: memberCount || 0,
        reports_submitted: reportCount || 0,
        budgets_submitted: budgetCount || 0,
        events_hosted: eventCount || 0,
        is_active: ministry.is_active,
      };
    })
  );

  return metrics;
}

/**
 * Get financial trends (basic - expenses and budgets)
 */
export async function getFinancialTrends(months: number = 12) {
  const endDate = new Date();
  const startDate = subMonths(endDate, months);

  // Get ministry reports with expenses
  const { data: reports, error: reportsError } = await supabase
    .from('ministry_reports')
    .select('submitted_at, expenses, ministries(name)')
    .gte('submitted_at', startDate.toISOString())
    .not('expenses', 'is', null)
    .order('submitted_at', { ascending: true });

  if (reportsError) throw reportsError;

  // Get budget requests
  const { data: budgets, error: budgetsError } = await supabase
    .from('ministry_budgets')
    .select('submitted_at, total_amount, status, ministries(name)')
    .gte('submitted_at', startDate.toISOString())
    .order('submitted_at', { ascending: true });

  if (budgetsError) throw budgetsError;

  // Group by month
  const monthlyData: Record<string, { expenses: number; budgetRequested: number; budgetApproved: number }> = {};

  // Initialize months
  const monthsArray = eachMonthOfInterval({ start: startDate, end: endDate });
  monthsArray.forEach(month => {
    const key = format(month, 'MMM yyyy');
    monthlyData[key] = { expenses: 0, budgetRequested: 0, budgetApproved: 0 };
  });

  // Sum expenses
  (reports || []).forEach(report => {
    const monthKey = format(new Date(report.submitted_at), 'MMM yyyy');
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].expenses += Number(report.expenses) || 0;
    }
  });

  // Sum budgets
  (budgets || []).forEach(budget => {
    const monthKey = format(new Date(budget.submitted_at), 'MMM yyyy');
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].budgetRequested += Number(budget.total_amount) || 0;
      if (budget.status === 'approved' || budget.status === 'allocated') {
        monthlyData[monthKey].budgetApproved += Number(budget.total_amount) || 0;
      }
    }
  });

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    expenses: data.expenses,
    budgetRequested: data.budgetRequested,
    budgetApproved: data.budgetApproved,
  }));
}

/**
 * Get engagement metrics
 */
export async function getEngagementMetrics() {
  // Get members who attended in last 30 days
  const thirtyDaysAgo = subMonths(new Date(), 1);
  
  const { data: recentAttendance, error } = await supabase
    .from('attendance')
    .select('member_id')
    .gte('service_date', format(thirtyDaysAgo, 'yyyy-MM-dd'));

  if (error) throw error;

  const uniqueAttendees = new Set((recentAttendance || []).map(a => a.member_id)).size;

  // Get total active members
  const { count: totalMembers } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const engagementRate = totalMembers ? Math.round((uniqueAttendees / totalMembers) * 100) : 0;

  return {
    activeMembers: uniqueAttendees,
    totalMembers: totalMembers || 0,
    engagementRate,
  };
}

/**
 * Get retention metrics
 */
export async function getRetentionMetrics() {
  const currentYear = new Date().getFullYear();
  
  // Members who joined this year
  const { count: newThisYear } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('date_joined', `${currentYear}-01-01`)
    .eq('status', 'active');

  // Members who left this year (inactive, transferred, etc.)
  const { count: leftThisYear } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .in('status', ['inactive', 'transferred', 'deceased'])
    .gte('updated_at', `${currentYear}-01-01`);

  return {
    newMembers: newThisYear || 0,
    lostMembers: leftThisYear || 0,
    netGrowth: (newThisYear || 0) - (leftThisYear || 0),
  };
}

/**
 * Get comparison data (current period vs previous period)
 */
export async function getComparisonData(currentStart: Date, currentEnd: Date) {
  const periodLength = differenceInDays(currentEnd, currentStart);
  const previousStart = subMonths(currentStart, 1);
  const previousEnd = subMonths(currentEnd, 1);

  // Current period attendance
  const { count: currentAttendance } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('service_date', format(currentStart, 'yyyy-MM-dd'))
    .lte('service_date', format(currentEnd, 'yyyy-MM-dd'));

  // Previous period attendance
  const { count: previousAttendance } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('service_date', format(previousStart, 'yyyy-MM-dd'))
    .lte('service_date', format(previousEnd, 'yyyy-MM-dd'));

  // Current period visitors
  const { count: currentVisitors } = await supabase
    .from('visitors')
    .select('*', { count: 'exact', head: true })
    .gte('visit_date', format(currentStart, 'yyyy-MM-dd'))
    .lte('visit_date', format(currentEnd, 'yyyy-MM-dd'));

  // Previous period visitors
  const { count: previousVisitors } = await supabase
    .from('visitors')
    .select('*', { count: 'exact', head: true })
    .gte('visit_date', format(previousStart, 'yyyy-MM-dd'))
    .lte('visit_date', format(previousEnd, 'yyyy-MM-dd'));

  const attendanceChange = previousAttendance 
    ? Math.round(((currentAttendance || 0) - previousAttendance) / previousAttendance * 100)
    : 0;

  const visitorsChange = previousVisitors
    ? Math.round(((currentVisitors || 0) - previousVisitors) / previousVisitors * 100)
    : 0;

  return {
    attendance: {
      current: currentAttendance || 0,
      previous: previousAttendance || 0,
      change: attendanceChange,
    },
    visitors: {
      current: currentVisitors || 0,
      previous: previousVisitors || 0,
      change: visitorsChange,
    },
  };
}

/**
 * Get announcement engagement metrics
 */
export async function getAnnouncementMetrics(startDate: Date, endDate: Date) {
  // Get announcements in period
  const { data: announcements, error: announcementsError } = await supabase
    .from('announcements')
    .select('id, title, published_at, view_count')
    .gte('published_at', format(startDate, 'yyyy-MM-dd'))
    .lte('published_at', format(endDate, 'yyyy-MM-dd'))
    .order('view_count', { ascending: false });

  if (announcementsError) throw announcementsError;

  // Get views breakdown by month
  const {data: views, error: viewsError } = await supabase
    .from('announcement_views')
    .select('viewed_at, announcement_id')
    .gte('viewed_at', startDate.toISOString())
    .lte('viewed_at', endDate.toISOString());

  if (viewsError) throw viewsError;

  // Group views by month
  const monthlyViews: Record<string, { views: number; announcements: number }> = {};
  const monthsArray = eachMonthOfInterval({ start: startDate, end: endDate });
  
  monthsArray.forEach(month => {
    const key = format(month, 'MMM yyyy');
    monthlyViews[key] = { views: 0, announcements: 0 };
  });

  (views || []).forEach(view => {
    const monthKey = format(new Date(view.viewed_at), 'MMM yyyy');
    if (monthlyViews[monthKey]) {
      monthlyViews[monthKey].views++;
    }
  });

  (announcements || []).forEach(announcement => {
    const monthKey = format(new Date(announcement.published_at), 'MMM yyyy');
    if (monthlyViews[monthKey]) {
      monthlyViews[monthKey].announcements++;
    }
  });

  const viewsByMonth = Object.entries(monthlyViews).map(([month, data]) => ({
    month,
    ...data,
  }));

  const totalAnnouncements = (announcements || []).length;
  const totalViews = (views || []).length;
  const avgViews = totalAnnouncements > 0 ? Math.round(totalViews / totalAnnouncements) : 0;

  // Top 5 announcements
  const topAnnouncements = (announcements || []).slice(0, 5).map(a => ({
    title: a.title.substring(0, 30) + (a.title.length > 30 ? '...' : ''),
    views: a.view_count || 0,
  }));

  return {
    totalAnnouncements,
    totalViews,
    avgViews,
    viewsByMonth,
    topAnnouncements,
  };
}

/**
 * Get report deadline metrics
 */
export async function getDeadlineMetrics(startDate: Date, endDate: Date) {
  const { data: deadlines, error } = await supabase
    .from('report_deadlines')
    .select('id, title, deadline_date, is_completed, completed_at, ministry_id, ministries(name)')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) throw error;

  const now = new Date();
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  let totalCompletionDays = 0;

  (deadlines || []).forEach(deadline => {
    if (deadline.is_completed) {
      completed++;
      if (deadline.completed_at) {
        const days = differenceInDays(
          new Date(deadline.completed_at),
          new Date(deadline.deadline_date)
        );
        totalCompletionDays += Math.abs(days);
      }
    } else {
      if (new Date(deadline.deadline_date) < now) {
        overdue++;
      } else {
        pending++;
      }
    }
  });

  const total = (deadlines || []).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const avgCompletionDays = completed > 0 ? Math.round(totalCompletionDays / completed) : 0;

  // Group by ministry
  const byMinistry: Record<string, { total: number; completed: number; overdue: number }> = {};
  (deadlines || []).forEach(deadline => {
    const ministryName = deadline.ministries?.name || 'Unknown';
    if (!byMinistry[ministryName]) {
      byMinistry[ministryName] = { total: 0, completed: 0, overdue: 0 };
    }
    byMinistry[ministryName].total++;
    if (deadline.is_completed) {
      byMinistry[ministryName].completed++;
    } else if (new Date(deadline.deadline_date) < now) {
      byMinistry[ministryName].overdue++;
    }
  });

  const ministryBreakdown = Object.entries(byMinistry).map(([ministry, data]) => ({
    ministry,
    ...data,
    completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
  }));

  return {
    total,
    completed,
    pending,
    overdue,
    completionRate,
    avgCompletionDays,
    ministryBreakdown,
  };
}

/**
 * Get member follow-up metrics
 */
export async function getFollowUpMetrics(startDate: Date, endDate: Date) {
  const { data: followUps, error } = await supabase
    .from('member_follow_ups')
    .select('id, status, reason, created_at, completed_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (error) throw error;

  // Status breakdown
  const statusCounts: Record<string, number> = {
    pending: 0,
    completed: 0,
    cancelled: 0,
  };

  let totalDuration = 0;
  let completedCount = 0;

  (followUps || []).forEach(followUp => {
    statusCounts[followUp.status]++;
    
    if (followUp.status === 'completed' && followUp.completed_at) {
      const days = differenceInDays(
        new Date(followUp.completed_at),
        new Date(followUp.created_at)
      );
      totalDuration += days;
      completedCount++;
    }
  });

  const byStatus = Object.entries(statusCounts).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count,
  }));

  // Reason breakdown
  const reasonCounts: Record<string, number> = {};
  (followUps || []).forEach(followUp => {
    const reason = followUp.reason || 'Not specified';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });

  const byReason = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const total = (followUps || []).length;
  const completionRate = total > 0 ? Math.round((statusCounts.completed / total) * 100) : 0;
  const avgDuration = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;

  return {
    total,
    pending: statusCounts.pending,
    completed: statusCounts.completed,
    cancelled: statusCounts.cancelled,
    completionRate,
    avgDuration,
    byStatus,
    byReason,
  };
}
