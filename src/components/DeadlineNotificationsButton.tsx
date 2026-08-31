import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { getUpcomingDeadlines, getOverdueDeadlines } from '@/services/reportDeadlines';

interface DeadlineNotificationsButtonProps {
  onClick: () => void;
}

export function DeadlineNotificationsButton({ onClick }: DeadlineNotificationsButtonProps) {
  const { profile } = useAuth();

  const upcomingQuery = useQuery({
    queryKey: ['upcoming-deadlines', profile?.id],
    queryFn: () => getUpcomingDeadlines(profile?.id || ''),
    enabled: !!profile?.id,
  });

  const overdueQuery = useQuery({
    queryKey: ['overdue-deadlines', profile?.id],
    queryFn: () => getOverdueDeadlines(profile?.id || ''),
    enabled: !!profile?.id,
  });

  const upcomingDeadlines = upcomingQuery.data || [];
  const overdueDeadlines = overdueQuery.data || [];
  const totalCount = upcomingDeadlines.length + overdueDeadlines.length;

  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="relative"
    >
      <Bell className="h-4 w-4" />
      Deadlines
      {totalCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {totalCount}
        </span>
      )}
    </Button>
  );
}
