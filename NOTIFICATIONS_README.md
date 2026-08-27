# 🔔 Smart Notifications & Reminders System

## Overview

The Smart Notifications & Reminders system automates communication with members, visitors, and ministry leaders through SMS messages. It includes 9 automated workflows that run in the background to keep your church community engaged.

## Features Implemented

### 1. **Birthday Greetings** 🎂
- **Trigger:** Member's birthday (based on `date_of_birth`)
- **Timing:** 8:00 AM on birthday
- **Recipients:** Active members with phone numbers
- **Message:** "Happy Birthday {first_name}! May God bless you abundantly on your special day. From your church family 🎉"

### 2. **Anniversary Greetings** 💑
- **Trigger:** Wedding anniversary
- **Status:** Ready for implementation (requires `wedding_date` field in members table)
- **Timing:** 8:00 AM on anniversary
- **Recipients:** Married members

### 3. **New Visitor Follow-Up Sequence** 👋
- **Trigger:** New visitor added to system
- **Sequence:**
  - **Day 1:** Welcome message immediately after visit
  - **Day 3:** Follow-up invitation to next service
  - **Day 7:** Check-in with pastoral contact info
- **Tracking:** Uses `visitor_followup_status` table to track which messages have been sent

### 4. **Inactive Member Re-engagement** 🔄
- **Trigger:** Member hasn't attended in 30+ days (configurable)
- **Timing:** Weekly check
- **Frequency:** Once per month per member
- **Message:** "We miss you {first_name}! Your church family is thinking of you. Hope to see you soon. Need anything? We're here 🙏"

### 5. **Event Reminders** 📅
- **Trigger:** Upcoming events
- **Sequence:**
  - **7 days before:** Save the date reminder
  - **1 day before:** Final reminder
- **Recipients:** All active members with phone numbers
- **Message:** "Don't forget! {event_title} on {event_date} at {event_time}. Location: {event_location}"

### 6. **Ministry Leader Reminders** 📋
- **Status:** Framework ready (needs specific triggers)
- **Use cases:**
  - Report due date reminders
  - Budget review notifications
  - Task due date alerts

### 7. **First Attendance Celebration** 🎊
- **Trigger:** Member's first recorded attendance
- **Timing:** Within 24 hours
- **Message:** "Congratulations {first_name} on your first service with us! Welcome to the church family! 🎊"

### 8. **Prayer Answered Follow-up** 🙏
- **Trigger:** Prayer request marked as "answered"
- **Timing:** Immediately
- **Message:** "Praise God! Your prayer has been answered! 🙌 We rejoice with you. Continue trusting in Him."

### 9. **Announcement Expiry Alert** ⏰
- **Trigger:** Announcement about to expire (1 day before)
- **Recipients:** Admin/Secretary
- **Purpose:** Reminds admin to renew or let announcement expire

---

## Database Tables

### `notification_workflows`
Stores configuration for each workflow type:
- `workflow_type`: Type of notification (enum)
- `name`: Display name
- `is_active`: Enable/disable toggle
- `schedule_config`: JSON configuration for timing
- `message_template`: Message text with placeholders
- `last_run_at`, `next_run_at`: Execution tracking

### `notification_queue`
Queue of pending/sent notifications:
- `workflow_type`: Which workflow created this
- `recipient_id`, `recipient_phone`: Who receives it
- `message`: Final message text
- `status`: pending/sent/failed/cancelled
- `scheduled_for`: When to send
- `sent_at`: When actually sent

### `notification_logs`
History of workflow executions:
- `workflow_type`: Which workflow ran
- `recipient_count`: How many notifications
- `successful_count`, `failed_count`: Success metrics
- `triggered_at`, `completed_at`: Timing

### `member_notification_preferences`
Member opt-in/opt-out preferences:
- `receive_birthday_sms`
- `receive_anniversary_sms`
- `receive_event_reminders`
- `receive_general_notifications`

### `visitor_followup_status`
Tracks which follow-up messages sent to each visitor:
- `day1_sent_at`, `day3_sent_at`, `day7_sent_at`

---

## Pages & UI

### **Notification Settings** (`/notification-settings`)
**Access:** Admin & Secretary only

**Features:**
- Enable/disable each workflow with toggle switches
- Edit message templates with placeholder support
- View last run time and schedule configuration
- Test workflows manually (Check Now button)
- Process pending queue immediately

**Message Placeholders:**
- `{first_name}`, `{last_name}`, `{full_name}`
- `{event_title}`, `{event_date}`, `{event_time}`, `{event_location}`
- `{days_inactive}`, `{church_name}`, `{pastor_name}`, `{pastor_phone}`

### **Notification History** (`/notification-history`)
**Access:** Admin & Secretary only

**Features:**
- Dashboard with stats (total sent, successful, failed, pending)
- Workflow performance metrics with success rates
- Filter by status (pending/sent/failed) and workflow type
- View all queued/sent notifications with details
- Recent workflow execution logs

---

## Services & Functions

### `src/services/notifications.ts`
Core notification service with functions:

#### Workflow Checkers:
- `checkBirthdays()`: Find and queue birthday greetings
- `checkAnniversaries()`: Find and queue anniversary greetings
- `checkNewVisitors()`: Process visitor follow-up sequence
- `checkInactiveMembers()`: Find members who haven't attended
- `checkEventReminders()`: Queue reminders for upcoming events
- `checkAllWorkflows()`: Run all checks at once

#### Queue Management:
- `queueNotification()`: Add notification to queue
- `processPendingNotifications()`: Send queued SMS via Arkesel
- `fetchNotificationQueue()`: Get queue items
- `fetchNotificationLogs()`: Get execution history

#### Utilities:
- `replacePlaceholders()`: Replace {placeholders} in messages
- `getNotificationStats()`: Overall statistics
- `getWorkflowStats()`: Per-workflow statistics

### `src/services/notificationScheduler.ts`
Background scheduler:

- `startNotificationScheduler()`: Start background checks (every 5 minutes)
- `stopNotificationScheduler()`: Stop scheduler
- `triggerSchedulerCycle()`: Manual execution for testing
- `isSchedulerRunning()`: Check if running

### `src/hooks/useNotificationScheduler.ts`
React hook that auto-starts scheduler when admin/secretary logs in

---

## How It Works

### Workflow Execution Flow:

1. **Scheduler runs** (every 5 minutes when admin/secretary is logged in)
2. **Workflow checks run** in parallel:
   - Check database for matching conditions (birthdays today, inactive members, etc.)
   - Generate personalized messages using templates
   - Queue notifications in `notification_queue` table
3. **Queue processor** sends pending notifications:
   - Groups by workflow type for batch sending
   - Sends via Arkesel SMS service
   - Updates status (sent/failed) in queue
   - Records execution in `notification_logs`
4. **Admin can view** results in Notification History page

### Example: Birthday Workflow

```
1. Scheduler calls checkBirthdays()
2. Query: Find members where DOB month/day = today, status = active, phone not null
3. For each match:
   - Check if already sent today (avoid duplicates)
   - Replace placeholders: "Happy Birthday {first_name}!" → "Happy Birthday John!"
   - queueNotification() adds to queue
4. processPendingNotifications() sends SMS via Arkesel
5. Update queue record: status = 'sent', sent_at = now()
6. Create log entry in notification_logs
```

---

## Installation & Setup

### 1. Run Migration

```bash
# In Supabase SQL Editor, run:
supabase/migrations/20260816_create_notification_system.sql
```

This creates all tables, enums, RLS policies, and inserts default workflows.

### 2. Configure Workflows

Navigate to `/notification-settings` and:
- Review default message templates
- Customize messages as needed
- Enable/disable workflows per your needs
- Test with "Check Now" button

### 3. Scheduler

The scheduler starts automatically when admin/secretary logs in. It:
- Checks workflows every 5 minutes
- Processes pending notifications immediately
- Runs in browser (client-side)

**For Production:** Replace with proper cron job:
- Supabase Edge Functions with `pg_cron` extension
- External cron service (e.g., GitHub Actions, Vercel Cron)
- Server-side scheduler

---

## Production Deployment

### Option 1: Supabase Edge Functions + pg_cron

1. **Enable pg_cron extension** in Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

2. **Create Edge Function**:
```typescript
// supabase/functions/run-notifications/index.ts
import { checkAllWorkflows, processPendingNotifications } from './notifications.ts';

Deno.serve(async (req) => {
  const result = await checkAllWorkflows();
  const processed = await processPendingNotifications();
  return new Response(JSON.stringify({ result, processed }));
});
```

3. **Schedule with pg_cron**:
```sql
SELECT cron.schedule(
  'run-notifications',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT.supabase.co/functions/v1/run-notifications',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

### Option 2: External Cron Service

Use GitHub Actions, Vercel Cron, or similar to hit an API endpoint every 5 minutes.

### Option 3: Dedicated Worker

Deploy a Node.js worker that runs 24/7 and executes the scheduler.

---

## Configuration Options

### Schedule Config Examples

**Birthday/Anniversary:**
```json
{
  "time": "08:00",
  "check_frequency": "daily"
}
```

**Visitor Follow-up:**
```json
{
  "day1": "immediate",
  "day3": true,
  "day7": true
}
```

**Inactive Members:**
```json
{
  "check_frequency": "weekly",
  "days_threshold": 30
}
```

**Event Reminders:**
```json
{
  "days_before": [7, 1],
  "hours_before": [2]
}
```

---

## SMS Cost Management

Each notification costs money via Arkesel. Manage costs:

1. **Set budgets** in workflow configuration
2. **Disable non-essential workflows** during low-budget periods
3. **Use recipient filters** to target specific groups
4. **Monitor stats** in Notification History page
5. **Opt-out system**: Let members disable certain notifications

**Cost Estimation:**
- Birthday messages: ~30-50 SMS/month (for 100 active members)
- Event reminders: 100-300 SMS per event (depending on size)
- Visitor follow-ups: 3 SMS per visitor
- Inactive member: ~10-20 SMS/month

---

## Testing

### Manual Testing:

1. Go to `/notification-settings`
2. Click "Check Now" to run all workflows
3. Check console logs for queued notifications
4. Click "Process Queue" to send immediately
5. View results in `/notification-history`

### Test Specific Workflows:

```typescript
// In browser console:
import { checkBirthdays } from '@/services/notifications';
await checkBirthdays(); // Returns count of queued notifications
```

### Test Without Sending SMS:

Temporarily disable SMS sending in `processPendingNotifications()` by commenting out the Arkesel call.

---

## Troubleshooting

### Notifications Not Sending?

1. **Check workflow is active** in Notification Settings
2. **Check scheduler is running** (console logs when admin logs in)
3. **Check queue** in Notification History - are there pending items?
4. **Check Arkesel credits** - do you have SMS balance?
5. **Check phone numbers** - are they valid Ghanaian numbers?
6. **Check RLS policies** - can the service access data?

### Duplicate Messages?

The system has duplicate prevention:
- Birthday: One per day per member
- Visitor: Tracks sent status in `visitor_followup_status`
- Inactive: One per month per member
- Events: One per event per reminder interval

If duplicates occur, check the duplicate prevention logic in workflow functions.

### Performance Issues?

- Limit queue processing to 100 items at a time
- Use indexes on frequently queried columns
- Consider moving to server-side cron for production

---

## Future Enhancements

### Potential Additions:

1. **Email notifications** as cheaper alternative to SMS
2. **WhatsApp integration** using WhatsApp Business API
3. **Push notifications** via Progressive Web App
4. **Smart scheduling** based on member timezone
5. **A/B testing** for message templates
6. **Delivery tracking** with read receipts
7. **Reply handling** for two-way conversations
8. **Member portal** to manage preferences
9. **Analytics dashboard** with charts and trends
10. **Multi-language support** based on member preferences

---

## API Reference

### Key Functions

#### `queueNotification(workflowType, recipientId, recipientName, recipientPhone, message, scheduledFor, metadata)`
Add a notification to the queue.

**Parameters:**
- `workflowType`: Type of notification
- `recipientId`: Member/visitor ID (can be null)
- `recipientName`: Display name
- `recipientPhone`: Phone number
- `message`: Final message text
- `scheduledFor`: When to send (Date)
- `metadata`: Additional data (object)

**Returns:** Promise<void>

#### `checkAllWorkflows()`
Run all workflow checks.

**Returns:** Promise<{birthdays, anniversaries, visitors, inactive, events}>

#### `processPendingNotifications()`
Send all pending notifications in queue.

**Returns:** Promise<{sent, failed}>

---

## Support

For issues or questions:
1. Check this README
2. Review console logs for errors
3. Check Notification History page for failure details
4. Verify Supabase RLS policies
5. Test Arkesel API connection

---

## Credits

Built for Abeka SDA Church Management System
SMS powered by Arkesel Ghana
