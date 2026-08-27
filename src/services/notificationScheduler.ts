/**
 * Notification Scheduler
 * 
 * This module handles the scheduling and execution of notification workflows.
 * In a production environment, this should be replaced with a proper cron job
 * or serverless function (e.g., Supabase Edge Functions with pg_cron).
 * 
 * For now, this provides a client-side scheduler that can be triggered manually
 * or run when admin is logged in.
 */

import {
  checkBirthdays,
  checkAnniversaries,
  checkNewVisitors,
  checkInactiveMembers,
  checkEventReminders,
  processPendingNotifications,
} from './notifications';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the notification scheduler
 * Checks workflows every 5 minutes and processes queue
 */
export function startNotificationScheduler() {
  if (isRunning) {
    console.log('Notification scheduler is already running');
    return;
  }

  console.log('Starting notification scheduler...');
  isRunning = true;

  // Run immediately on start
  runSchedulerCycle().catch(console.error);

  // Then run every 5 minutes
  schedulerInterval = setInterval(() => {
    runSchedulerCycle().catch(console.error);
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Stop the notification scheduler
 */
export function stopNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    isRunning = false;
    console.log('Notification scheduler stopped');
  }
}

/**
 * Run a single scheduler cycle
 */
async function runSchedulerCycle() {
  try {
    console.log('[Scheduler] Running notification checks...');

    // Check all workflows in parallel
    const results = await Promise.allSettled([
      checkBirthdays(),
      checkAnniversaries(),
      checkNewVisitors(),
      checkInactiveMembers(),
      checkEventReminders(),
    ]);

    const counts = {
      birthdays: results[0].status === 'fulfilled' ? results[0].value : 0,
      anniversaries: results[1].status === 'fulfilled' ? results[1].value : 0,
      visitors: results[2].status === 'fulfilled' ? results[2].value : 0,
      inactive: results[3].status === 'fulfilled' ? results[3].value : 0,
      events: results[4].status === 'fulfilled' ? results[4].value : 0,
    };

    const totalQueued = Object.values(counts).reduce((sum, val) => sum + val, 0);

    if (totalQueued > 0) {
      console.log(
        `[Scheduler] Queued ${totalQueued} notifications:`,
        counts
      );
    }

    // Process pending notifications
    const { sent, failed } = await processPendingNotifications();

    if (sent > 0 || failed > 0) {
      console.log(
        `[Scheduler] Processed queue: ${sent} sent, ${failed} failed`
      );
    }

    // Log errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const workflowNames = [
          'birthdays',
          'anniversaries',
          'visitors',
          'inactive',
          'events',
        ];
        console.error(
          `[Scheduler] Error in ${workflowNames[index]}:`,
          result.reason
        );
      }
    });
  } catch (err) {
    console.error('[Scheduler] Error in scheduler cycle:', err);
  }
}

/**
 * Manually trigger a scheduler cycle (for testing)
 */
export async function triggerSchedulerCycle() {
  await runSchedulerCycle();
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning() {
  return isRunning;
}
