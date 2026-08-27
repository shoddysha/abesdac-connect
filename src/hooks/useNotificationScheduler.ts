import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from '@/services/notificationScheduler';

/**
 * Hook to start notification scheduler when admin/secretary is logged in
 * This is a client-side implementation. In production, use a proper cron job.
 */
export function useNotificationScheduler() {
  const { profile, hasRole } = useAuth();

  useEffect(() => {
    // Only run scheduler if user is admin or secretary
    if (profile && hasRole('administrator', 'secretary')) {
      console.log('Starting notification scheduler for admin/secretary...');
      startNotificationScheduler();

      // Cleanup on unmount
      return () => {
        stopNotificationScheduler();
      };
    }
  }, [profile, hasRole]);
}
