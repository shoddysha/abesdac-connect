import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationCounts {
  ministryReports: number;
  memberFollowUps: number;
  budgets: number;
  announcements: number;
  total: number;
}

export function useNotificationCounts() {
  const { profile, hasRole } = useAuth();
  const isAdminOrSecretary = hasRole('administrator', 'secretary');

  return useQuery({
    queryKey: ['notification-counts', profile?.id],
    queryFn: async (): Promise<NotificationCounts> => {
      // Count recent active announcements (available to all roles)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: announcementsCount } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true })
        .gte('published_at', thirtyDaysAgo.toISOString())
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

      const announcements = announcementsCount || 0;

      // Admin/Secretary specific counts
      if (!isAdminOrSecretary) {
        return { ministryReports: 0, memberFollowUps: 0, budgets: 0, announcements, total: announcements };
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
      const total = ministryReports + memberFollowUps + budgets + announcements;

      return { ministryReports, memberFollowUps, budgets, announcements, total };
    },
    enabled: !!profile?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
