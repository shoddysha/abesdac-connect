# Event Auto-Update Setup Guide

## Overview

Automatically updates event statuses:
- **Upcoming → Ongoing**: When event start time is reached
- **Ongoing/Upcoming → Completed**: 48 hours after event start time

---

## Step 1: Deploy the Edge Function

```bash
supabase functions deploy update-event-status
```

**Output should show:**
```
Deployed function update-event-status
URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-event-status
```

---

## Step 2: Set Up Cron Job (Automatic Scheduling)

### Option A: Using Supabase Cron Job (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Database** → **Cron Jobs**
4. Click **Create a new cron job**
5. Paste this SQL:

```sql
-- Run every hour to update event statuses
SELECT cron.schedule(
  'update-event-statuses-hourly', -- job name
  '0 * * * *', -- every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-event-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

6. **Replace** `YOUR_PROJECT_REF` with your actual project reference
7. Click **Run** to create the cron job

---

### Option B: Using pg_cron Extension

If you don't have the Cron Jobs UI, run this SQL in the SQL Editor:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job
SELECT cron.schedule(
  'update-event-statuses-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-event-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Replace**:
- `YOUR_PROJECT_REF` with your project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key (from Settings → API)

---

## Step 3: Test Manually

Test the function manually to ensure it works:

### Using curl:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-event-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{}'
```

### Using Browser (Supabase Dashboard):

1. Go to **Edge Functions**
2. Click **update-event-status**
3. Go to **Invoke** tab
4. Click **Invoke Function**
5. Check response

**Expected Response:**
```json
{
  "success": true,
  "message": "Event statuses updated successfully",
  "updatedOngoing": 0,
  "updatedCompleted": 2,
  "timestamp": "2025-01-15T10:00:00Z"
}
```

---

## Step 4: Verify It's Working

### Check Cron Job

```sql
-- View all scheduled cron jobs
SELECT * FROM cron.job;

-- Check recent runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update-event-statuses-hourly')
ORDER BY start_time DESC
LIMIT 10;
```

### Check Edge Function Logs

1. Go to **Edge Functions** → **update-event-status**
2. Click **Logs** tab
3. Should see hourly executions

---

## How It Works

### Timing Logic

```
Event created with start_time: Jan 15, 2025 10:00 AM

Timeline:
├─ Before Jan 15, 10:00 AM  → Status: "upcoming"
├─ Jan 15, 10:00 AM         → Status: "ongoing" (auto-updated)
├─ Jan 17, 10:00 AM (+48h)  → Status: "completed" (auto-updated)
```

### Update Rules

**Rule 1: Upcoming → Ongoing**
- Condition: `status = 'upcoming' AND start_time <= NOW()`
- Result: Status changes to `'ongoing'`

**Rule 2: Ongoing/Upcoming → Completed**
- Condition: `status IN ('upcoming', 'ongoing') AND start_time <= NOW() - 48 hours`
- Result: Status changes to `'completed'`

---

## Cron Schedule Options

Current: `0 * * * *` (every hour)

**Other options:**

```
'*/15 * * * *'   -- Every 15 minutes
'0 */2 * * *'    -- Every 2 hours
'0 0 * * *'      -- Daily at midnight
'*/30 * * * *'   -- Every 30 minutes
```

**Recommendation**: Every hour (`0 * * * *`) is sufficient for most churches.

---

## Troubleshooting

### Events not updating?

1. **Check cron job is running:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'update-event-statuses-hourly';
   ```

2. **Check function logs:**
   - Supabase Dashboard → Edge Functions → update-event-status → Logs

3. **Test manually:**
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-event-status
   ```

4. **Check event data:**
   ```sql
   SELECT id, title, start_time, status 
   FROM events 
   WHERE start_time < NOW() 
   ORDER BY start_time DESC;
   ```

---

### Cron job failing?

**Error: "Could not find the function"**
- Solution: Deploy function first: `supabase functions deploy update-event-status`

**Error: "Authorization failed"**
- Solution: Check service role key is correct

**Error: "Extension pg_net not found"**
- Solution: Enable in SQL Editor:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_net;
  ```

---

## Disable Auto-Update

If you need to stop auto-updates:

```sql
-- Disable the cron job
SELECT cron.unschedule('update-event-statuses-hourly');
```

To re-enable, run the schedule SQL again.

---

## Manual Event Status Update

If you need to manually trigger an update:

### Via Edge Function:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-event-status
```

### Via SQL:
```sql
-- Update events to ongoing (start time reached)
UPDATE events 
SET status = 'ongoing' 
WHERE status = 'upcoming' 
  AND start_time <= NOW();

-- Update events to completed (48 hours passed)
UPDATE events 
SET status = 'completed' 
WHERE status IN ('upcoming', 'ongoing')
  AND start_time <= NOW() - INTERVAL '48 hours';
```

---

## Testing

### Create Test Events

```sql
-- Event that should be ongoing (started 1 hour ago)
INSERT INTO events (title, location, start_time, end_time, status)
VALUES (
  'Test Ongoing Event',
  'Church Hall',
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '1 hour',
  'upcoming'
);

-- Event that should be completed (started 50 hours ago)
INSERT INTO events (title, location, start_time, end_time, status)
VALUES (
  'Test Completed Event',
  'Church Hall',
  NOW() - INTERVAL '50 hours',
  NOW() - INTERVAL '48 hours',
  'upcoming'
);
```

### Run Update Function

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-event-status
```

### Check Results

```sql
SELECT title, start_time, status FROM events WHERE title LIKE 'Test%';
```

**Expected**:
- "Test Ongoing Event" → status = 'ongoing'
- "Test Completed Event" → status = 'completed'

---

## Summary

✅ **Deployed**: `update-event-status` Edge Function  
✅ **Scheduled**: Cron job runs every hour  
✅ **Auto-updates**: Events change status automatically  
✅ **Ongoing**: When start time reached  
✅ **Completed**: 48 hours after start time  

Ready to go! 🚀
