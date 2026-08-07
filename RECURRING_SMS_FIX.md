# Recurring Service Reminders - Fix

## Issue
Error: "Could not find the 'message' column of 'recurring_service_reminders' in the schema cache"

## Root Cause
Column name mismatch:
- **Code expected**: `message` and `send_day_offset`
- **Migration had**: `message_template` and `send_day`

## Solution
Updated migration file to match TypeScript interface.

---

## Fixed Migration

**File**: `supabase/migrations/add_recurring_service_reminders.sql`

### Correct Column Names:
- ✅ `message` (not `message_template`)
- ✅ `send_day_offset` (not `send_day`)

### Column Details:

**`send_day_offset`**: Days offset from service day
- **-1** = Send 1 day before service
- **0** = Send on service day
- **1** = Send 1 day after service
- Range: -7 to +7 days

**`message`**: SMS message text to send

---

## How to Apply

### Step 1: Run the Migration

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the entire contents of:
   ```
   supabase/migrations/add_recurring_service_reminders.sql
   ```
6. Click **Run**

### Step 2: Verify Table Created

Run this SQL to check:

```sql
-- Check table exists
SELECT * FROM recurring_service_reminders LIMIT 1;

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recurring_service_reminders'
ORDER BY ordinal_position;
```

**Expected Columns**:
- id (uuid)
- service_type (USER-DEFINED)
- send_day_offset (integer)
- send_time (time without time zone)
- message (text)
- is_active (boolean)
- created_at (timestamp with time zone)
- updated_at (timestamp with time zone)
- created_by (uuid)

---

## Test Creating a Recurring Reminder

After running the migration, test in your CMS:

1. Go to **SMS** page
2. Scroll to **Recurring Service Reminders**
3. Click **Add Reminder**
4. Fill in:
   - Service Type: Sabbath Service
   - Send Day: Friday (day before Sabbath)
   - Send Time: 6:00 PM
   - Message: "Reminder: Sabbath service tomorrow at 9:00 AM. See you there!"
5. Click **Save**

Should work without errors! ✅

---

## Example Reminders

### Sabbath Service (Saturday)
```
Service Type: sabbath_service
Send Day Offset: -1 (Friday)
Send Time: 18:00 (6:00 PM)
Message: "Reminder: Sabbath service tomorrow at 9:00 AM. God bless!"
```

### Midweek Service (Wednesday)
```
Service Type: midweek_service
Send Day Offset: 0 (Wednesday)
Send Time: 09:00 (9:00 AM)
Message: "Today: Midweek prayer service at 6:00 PM. Join us!"
```

### Sunday Bible Study (Sunday)
```
Service Type: sunday_bible_study
Send Day Offset: -1 (Saturday)
Send Time: 19:00 (7:00 PM)
Message: "Tomorrow: Sunday Bible Study at 10:00 AM. Prepare your hearts!"
```

---

## Troubleshooting

### Still getting schema cache error?

1. **Refresh schema cache** in Supabase:
   - Go to **API Docs** → Click **Refresh** button at top

2. **Check table was created**:
   ```sql
   SELECT * FROM recurring_service_reminders;
   ```

3. **Drop and recreate** (if needed):
   ```sql
   DROP TABLE IF EXISTS recurring_service_reminders CASCADE;
   -- Then run the migration again
   ```

### Can't find the table?

Make sure you ran the migration in the **correct project**:
- Check you're in the right Supabase project
- Check project name at top of dashboard

---

## Summary

✅ **Fixed**: Column names now match TypeScript interface  
✅ **Columns**: `message` and `send_day_offset` (correct)  
✅ **Migration**: Ready to run in Supabase SQL Editor  

Run the migration and you're good to go! 🚀
