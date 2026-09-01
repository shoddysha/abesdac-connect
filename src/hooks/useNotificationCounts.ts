import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getUnviewedAnnouncementCount } from '@/services/announcements';
import { useRealtimeQuery } from './useRealtimeQuery';

export interface NotificationCounts {
  ministryReports: number;
  memberFollowUps: number;
  budgets: number;
  announcements: number;
  deadlines: number;
  total: number;
}

export function useNotificationCounts() {
  const { profile, hasRole } = useAuth();
  const isAdminOrSecretary = hasRole('administrator', 'secretary');
  const isMinistryLeader = hasRole('ministry_leader');

  const query = useQuery({
    queryKey: ['notification-counts', profile?.id],
    queryFn: async (): Promise<NotificationCounts> => {
      // Count UNVIEWED announcements (available to all roles)
      const announcements = await getUnviewedAnnouncementCount();

      // Ministry Leader specific counts (deadlines)
      let deadlines = 0;
      if (isMinistryLeader && profile?.id) {
        // Get ministries where user is a leader
        const { data: ministryData } = await supabase
          .from('ministries')
          .select('id')
          .eq('leader_id', profile.id);

        const ministryIds = ministryData?.map((m: any) => m.id) || [];

        if (ministryIds.length > 0) {
          const now = new Date();
          const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          // Count upcoming deadlines (next 7 days)
          const { count: upcomingCount } = await supabase
            .from('report_deadlines')
            .select('*', { count: 'exact', head: true })
            .in('ministry_id', ministryIds)
            .eq('is_completed', false)
            .gte('deadline_date', now.toISOString())
            .lte('deadline_date', sevenDaysLater.toISOString());

          // Count overdue deadlines
          const { count: overdueCount } = await supabase
            .from('report_deadlines')
            .select('*', { count: 'exact', head: true })
            .in('ministry_id', ministryIds)
            .eq('is_completed', false)
            .lt('deadline_date', now.toISOString());

          deadlines = (upcomingCount || 0) + (overdueCount || 0);
        }
      }

      // Admin/Secretary specific counts
      if (!isAdminOrSecretary) {
        return { 
          ministryReports: 0, 
          memberFollowUps: 0, 
          budgets: 0, 
          announcements, 
          deadlines,
          total: announcements + deadlines 
        };
      }

      // Count unacknowledged ministry reports
      const { count: reportsCount } = await supabase
        .from('ministry_reports')
        .select('*', { count: 'exact', head: true })
        .is('acknowledged_at', null);

      // Count pending follow-ups
      const { count: followUpsCount } = await supabase
        .from('member_follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Count pending budgets
      const { count: budgetsCount } = await supabase
        .from('ministry_budgets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const ministryReports = reportsCount || 0;
      const memberFollowUps = followUpsCount || 0;
      const budgets = budgetsCount || 0;
      const total = ministryReports + memberFollowUps + budgets + announcements + deadlines;

      return { ministryReports, memberFollowUps, budgets, announcements, deadlines, total };
    },
    enabled: !!profile?.id,
  });

  // Set up real-time subscriptions to auto-refresh counts when data changes
  useRealtimeQuery('announcements', ['notification-counts', profile?.id]);
  useRealtimeQuery('announcement_views', ['notification-counts', profile?.id]);
  useRealtimeQuery('report_deadlines', ['notification-counts', profile?.id]);
  useRealtimeQuery('ministry_reports', ['notification-counts', profile?.id]);
  useRealtimeQuery('member_follow_ups', ['notification-counts', profile?.id]);
  useRealtimeQuery('ministry_budgets', ['notification-counts', profile?.id]);

  return query;
}