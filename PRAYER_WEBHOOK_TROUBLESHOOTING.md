# Prayer Request Webhook - Troubleshooting Guide

## Issue: Google Form submissions not appearing in CMS

### Step 1: Check if Webhook is Deployed

```bash
# Deploy the webhook function
supabase functions deploy receive-prayer-request

# You should see output like:
# Deployed function receive-prayer-request
# URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/receive-prayer-request
```

**Copy the URL** - you'll need it for the Apps Script.

---

### Step 2: Test Webhook Directly

Open your browser or use curl to test:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/receive-prayer-request \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "prayer_request": "This is a test prayer request",
    "anonymous": "No",
    "timestamp": "2025-01-01T12:00:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Prayer request received successfully",
  "id": "some-uuid"
}
```

**If you get an error**, check:
- Is the function deployed?
- Is your Supabase project active?
- Check Edge Function logs in Supabase Dashboard

---

### Step 3: Check Google Apps Script

1. Open your Google Form
2. Click **⋮** (3 dots) → **Script editor**
3. Check the code is there
4. **IMPORTANT**: Check the webhook URL is correct

```javascript
// This should match your deployed webhook URL
const WEBHOOK_URL = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/receive-prayer-request';
```

4. Check the trigger exists:
   - Click **⏰ Triggers** (left sidebar)
   - Should see: `onFormSubmit`, `From form`, `On form submit`
   - If missing, create it again

---

### Step 4: Test Google Apps Script

In the Apps Script editor:

1. Click on `onFormSubmit` function
2. Click **Run** button (▶️)
3. You'll get an error (expected - no event object)
4. Click **Executions** (left sidebar)
5. Check for any errors

---

### Step 5: Submit Test Form

1. Open your Google Form
2. Submit a test prayer request:
   - Name: "Test User"
   - Prayer Request: "Testing webhook integration"
   - Anonymous: No
3. Click Submit

---

### Step 6: Check Apps Script Execution Logs

In Apps Script editor:

1. Click **Executions** (left sidebar)
2. Look for the most recent execution
3. Click on it to see details
4. Check for errors

**Common Errors:**

**Error: "TypeError: Cannot read property 'getItemResponses'"**
- Solution: Trigger not set up correctly. Re-create trigger.

**Error: "Request failed with status 404"**
- Solution: Webhook URL is wrong. Check deployment URL.

**Error: "Request failed with status 500"**
- Solution: Check Supabase Edge Function logs for details.

---

### Step 7: Check Supabase Edge Function Logs

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Edge Functions**
4. Click **receive-prayer-request**
5. Go to **Logs** tab
6. Check for recent requests

**What to look for:**
- ✅ Successful requests: Status 200
- ❌ Failed requests: Status 400, 500
- Error messages showing what went wrong

---

### Step 8: Check Database

1. In Supabase Dashboard → **Table Editor**
2. Open `prayer_requests` table
3. Check if your test request is there

**If it's not there but logs show success:**
- Check RLS policies are correct
- Make sure `prayer_requests` table exists

---

## Common Issues & Solutions

### Issue 1: "Function not found (404)"

**Problem**: Webhook not deployed or wrong URL

**Solution**:
```bash
supabase functions deploy receive-prayer-request
```

Make sure you're using the correct URL in Apps Script.

---

### Issue 2: "Missing required fields"

**Problem**: Form question order doesn't match script

**Solution**: Check your Google Form has questions in this order:
1. Name (short answer)
2. Prayer Request (paragraph)
3. Anonymous (multiple choice)

**In Apps Script**, the code should be:
```javascript
const responses = e.response.getItemResponses();
const name = responses[0]?.getResponse() || '';
const prayerRequest = responses[1]?.getResponse() || '';
const anonymous = responses[2]?.getResponse() || 'No';
```

---

### Issue 3: "No trigger found"

**Problem**: Trigger not created

**Solution**: In Apps Script:
1. Click **⏰ Triggers**
2. Click **+ Add Trigger**
3. Settings:
   - Function: `onFormSubmit`
   - Event source: `From form`
   - Event type: `On form submit`
4. Save

---

### Issue 4: Webhook receives data but nothing in CMS

**Problem**: RLS policies blocking insert

**Solution**: Run this SQL in Supabase SQL Editor:

```sql
-- Check if table exists
SELECT * FROM prayer_requests LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'prayer_requests';

-- If policies are missing, run the migration again
-- Copy/paste contents of: supabase/migrations/add_prayer_requests.sql
```

---

## Quick Checklist

- [ ] Webhook deployed (`supabase functions deploy receive-prayer-request`)
- [ ] Webhook URL copied
- [ ] Google Apps Script has correct webhook URL
- [ ] Apps Script trigger exists ("On form submit")
- [ ] Google Form has 3 questions in correct order
- [ ] Test form submission completed
- [ ] Check Executions in Apps Script for errors
- [ ] Check Edge Function logs in Supabase
- [ ] Check `prayer_requests` table has data
- [ ] Migration `add_prayer_requests.sql` has been run

---

## Still Not Working?

### Manual Test in Apps Script

Replace your `onFormSubmit` function with this test version:

```javascript
function testManualSubmit() {
  const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';
  
  const payload = {
    name: 'Manual Test User',
    prayer_request: 'This is a manual test from Apps Script',
    anonymous: 'No',
    timestamp: new Date().toISOString()
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    Logger.log('Response Code: ' + responseCode);
    Logger.log('Response Body: ' + responseBody);
    
    if (responseCode === 200) {
      Logger.log('✅ SUCCESS! Check your CMS prayer requests page.');
    } else {
      Logger.log('❌ FAILED with code: ' + responseCode);
    }
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.toString());
  }
}
```

Run this function and check the logs.

---

## Contact Support

If none of this works, check:
1. Supabase project is not paused
2. You have the correct project selected
3. Function secrets are set (if any)
4. Your internet connection is stable

---

## Success Indicators

When everything works:

✅ **Apps Script Executions**: Shows "Completed" status  
✅ **Edge Function Logs**: Shows 200 status code  
✅ **Database Table**: Has new prayer request row  
✅ **CMS**: Prayer request visible in Prayer Requests page  

You're done! 🎉
