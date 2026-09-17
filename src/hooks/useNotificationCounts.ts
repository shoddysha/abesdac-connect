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
  const isPastor = hasRole('pastor');

  const query = useQuery({
    queryKey: ['notification-counts', profile?.id || 'unauthenticated'],
    refetchInterval: 10000,
    queryFn: async (): Promise<NotificationCounts> => {
      // Count UNVIEWED announcements (available to all roles)
      const announcements = await getUnviewedAnnouncementCount();

      // Ministry Leader specific counts (deadlines)
      let deadlines = 0;
      if (isMinistryLeader && profile?.id) {
        const { data: ministryData } = await supabase
          .from('ministries')
          .select('id')
          .eq('leader_id', profile.id);

        const ministryIds = ministryData?.map((m: any) => m.id) || [];

        if (ministryIds.length > 0) {
          const now = new Date();
          const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          const { count: upcomingCount } = await supabase
            .from('report_deadlines')
            .select('*', { count: 'exact', head: true })
            .in('ministry_id', ministryIds)
            .eq('is_completed', false)
            .gte('deadline_date', now.toISOString())
            .lte('deadline_date', sevenDaysLater.toISOString());

          const { count: overdueCount } = await supabase
            .from('report_deadlines')
            .select('*', { count: 'exact', head: true })
            .in('ministry_id', ministryIds)
            .eq('is_completed', false)
            .lt('deadline_date', now.toISOString());

          deadlines = (upcomingCount || 0) + (overdueCount || 0);
        }
      }

      // Pastor: count their pending follow-ups church-wide
      let pastorFollowUps = 0;
      if (isPastor) {
        try {
          const { count } = await supabase
            .from('member_followups')
            .select('*', { count: 'exact', head: true })
            .is('completed_at', null);
          pastorFollowUps = count || 0;
        } catch {
          pastorFollowUps = 0;
        }
      }

      // Non-admin/secretary early return
      if (!isAdminOrSecretary) {
        return {
          ministryReports: 0,
          memberFollowUps: pastorFollowUps,
          budgets: 0,
          announcements,
          deadlines,
          total: announcements + deadlines + pastorFollowUps,
        };
      }

      // Count unacknowledged ministry reports
      const { count: reportsCount } = await supabase
        .from('ministry_reports')
        .select('*', { count: 'exact', head: true })
        .is('acknowledged_at', null);

      // Count pending follow-ups
      // TEMPORARILY DISABLED until table is created
      let followUpsCount = 0;
      try {
        const { count } = await supabase
          .from('member_follow_ups')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        followUpsCount = count || 0;
      } catch (error) {
        console.warn('member_follow_ups table not found - using 0');
        followUpsCount = 0;
      }

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
  // DISABLED - causes white screen error
  /*
  const stableQueryKey = ['notification-counts', profile?.id || 'unauthenticated'];
  
  useRealtimeQuery('announcements', stableQueryKey);
  useRealtimeQuery('announcement_views', stableQueryKey);
  useRealtimeQuery('report_deadlines', stableQueryKey);
  useRealtimeQuery('ministry_reports', stableQueryKey);
  useRealtimeQuery('member_follow_ups', stableQueryKey);
  useRealtimeQuery('ministry_budgets', stableQueryKey);
  */

  return query;
}