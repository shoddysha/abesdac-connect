# Google Forms Prayer Requests Integration Setup Guide

This guide explains how to set up automatic prayer request syncing from Google Forms into your CMS.

---

## Overview

**How it works:**
1. Church members fill out a public Google Form to submit prayer requests
2. Responses are automatically saved to a Google Sheet
3. Your CMS has a "Sync Now" button that fetches new responses from the Google Sheet
4. New prayer requests appear automatically in your Prayer Requests page

---

## Part 1: Create the Google Form

### Step 1: Create the Form
1. Go to [Google Forms](https://forms.google.com)
2. Click **+ Blank** to create a new form
3. Title it: **"Abeka SDA Church - Prayer Request"**

### Step 2: Add Form Questions

Add these questions in this exact order:

**Question 1: Your Name** (Short answer)
- Required: Yes
- Help text: "Enter your full name (or 'Anonymous' if you prefer)"

**Question 2: Prayer Request** (Paragraph)
- Required: Yes
- Help text: "Share your prayer request in detail. Our pastoral team will include it in intercessory prayer."

**Question 3: Submit Anonymously?** (Multiple choice)
- Required: Yes
- Options:
  - No, use my name
  - Yes, keep it anonymous
- Default: "No, use my name"

### Step 3: Configure Form Settings
1. Click **Settings** (gear icon)
2. Under **General**:
   - ✅ Collect email addresses: OFF (optional - turn on if you want emails)
   - ✅ Limit to 1 response: OFF
   - ✅ Response receipts: ON (optional)
3. Under **Presentation**:
   - Confirmation message: "Thank you for your prayer request. Our pastoral team will lift you up in prayer."

### Step 4: Get the Form Link
1. Click **Send** button (top right)
2. Click the **Link** icon
3. Click **Shorten URL**
4. **Copy this link** - you'll share this with your church members

---

## Part 2: Set Up Google Sheets API Access

### Step 1: Enable Google Sheets API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Click **APIs & Services** → **Enable APIs and Services**
4. Search for **"Google Sheets API"**
5. Click **Enable**

### Step 2: Create API Key
1. In Google Cloud Console, go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API Key**
3. Copy the API key (you'll need this later)
4. Click **Edit API key** (optional but recommended):
   - Under **API restrictions**, select **Restrict key**
   - Select only **Google Sheets API**
   - Add **Application restrictions** (optional):
     - HTTP referrers: Add your CMS domain
   - Click **Save**

### Step 3: Get Your Google Sheet ID
1. Open the Google Form you created
2. Click **Responses** tab
3. Click the green **Sheets icon** to create a spreadsheet
4. The spreadsheet will open - look at the URL:
   ```
   https://docs.google.com/spreadsheets/d/1abc...xyz/edit
                                            ^^^^^^^^^
                                         This is your Sheet ID
   ```
5. Copy the Sheet ID (the long string between `/d/` and `/edit`)

### Step 4: Make Sheet Publicly Readable
1. In the Google Sheet, click **Share** button
2. Under **General access**, change to:
   - **Anyone with the link** → **Viewer**
3. Click **Done**

---

## Part 3: Configure Supabase

### Step 1: Run the Migration
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/add_prayer_requests.sql`
5. Click **Run**
6. Verify the `prayer_requests` table was created

### Step 2: Deploy the Edge Function
1. Install Supabase CLI if you haven't:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy sync-prayer-requests
   ```

### Step 3: Set Edge Function Secrets
1. In Supabase Dashboard, go to **Edge Functions**
2. Click on **sync-prayer-requests**
3. Go to **Secrets** tab
4. Add these secrets:

   **GOOGLE_SHEETS_API_KEY**
   - Value: Your API key from Part 2, Step 2

   **PRAYER_REQUESTS_SHEET_ID**
   - Value: Your Sheet ID from Part 2, Step 3

5. Click **Save**

---

## Part 4: Update Your CMS

### Step 1: Update the Prayer Form Link
1. Open `src/pages/PrayerRequests.tsx`
2. Find this line:
   ```tsx
   href="https://forms.google.com/your-form-url"
   ```
3. Replace it with your actual Google Form link (from Part 1, Step 4)

### Step 2: Deploy Your CMS
```bash
git add .
git commit -m "Add Google Forms prayer request integration"
git push
```

---

## Part 5: Test the Integration

### Step 1: Submit a Test Request
1. Open your Google Form link
2. Fill out a test prayer request:
   - Name: "Test User"
   - Prayer Request: "This is a test request"
   - Anonymous: No
3. Submit the form

### Step 2: Verify in Google Sheets
1. Open the Google Sheet linked to your form
2. You should see your test response in the spreadsheet

### Step 3: Sync to CMS
1. Login to your CMS
2. Go to **Prayer Requests** page
3. Click **Sync Now** button
4. You should see: "Synced 1 new prayer request"
5. Your test request should appear in the list

### Step 4: Test Features
- ✅ Change status to "Ongoing"
- ✅ Mark as "Answered" with testimony notes
- ✅ Filter by status
- ✅ Search prayer requests
- ✅ Submit another form response and sync again

---

## Column Mapping Reference

The Edge Function expects these columns in your Google Sheet (in this order):

| Column | Name | Description |
|--------|------|-------------|
| A | Timestamp | Auto-generated by Google Forms |
| B | Name | Person's name (or "Anonymous") |
| C | Prayer Request | The prayer request text |
| D | Anonymous | "Yes" or "No, use my name" |

**If your form has different questions or order**, update the Edge Function:

Open `supabase/functions/sync-prayer-requests/index.ts` and modify this line:
```typescript
const [timestamp, name, prayerRequest, anonymous] = row;
```

Match it to your actual column order.

---

## Automatic Syncing (Optional)

To sync automatically without clicking "Sync Now":

### Option 1: Scheduled Sync (Recommended)
1. In Supabase Dashboard, go to **Database** → **Cron Jobs**
2. Create a new cron job:
   ```sql
   SELECT cron.schedule(
     'sync-prayer-requests-hourly',
     '0 * * * *', -- Every hour
     $$
     SELECT net.http_post(
       url := 'https://your-project-ref.supabase.co/functions/v1/sync-prayer-requests',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

### Option 2: Real-time with Google Apps Script
1. In your Google Sheet, go to **Extensions** → **Apps Script**
2. Paste this code:
   ```javascript
   function onFormSubmit(e) {
     const url = 'https://your-project-ref.supabase.co/functions/v1/sync-prayer-requests';
     const options = {
       method: 'post',
       headers: {
         'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
         'Content-Type': 'application/json'
       }
     };
     UrlFetchApp.fetch(url, options);
   }
   ```
3. Click **Triggers** → **Add Trigger**
4. Choose: `onFormSubmit`, `From spreadsheet`, `On form submit`
5. Click **Save**

Now new prayer requests sync immediately!

---

## Troubleshooting

### "Missing Google Sheets configuration" Error
- Make sure you set both secrets in Supabase Edge Functions:
  - `GOOGLE_SHEETS_API_KEY`
  - `PRAYER_REQUESTS_SHEET_ID`

### "Google Sheets API error: 403" Error
- Check that the Google Sheet is shared as "Anyone with the link can view"
- Verify your API key is correct and hasn't been restricted too much

### "No new prayer requests found"
- Check the Google Sheet has responses
- Verify column order matches the Edge Function mapping
- Check Supabase logs: **Edge Functions** → **sync-prayer-requests** → **Logs**

### Duplicate Imports
- The system uses `google_form_timestamp` to prevent duplicates
- Each row is imported only once based on its timestamp

---

## Sharing the Form with Church Members

**Ways to share:**
1. **SMS/WhatsApp**: Send the shortened form link
2. **Church Website**: Add a "Submit Prayer Request" button
3. **QR Code**: Generate a QR code pointing to the form
   - Use [qr-code-generator.com](https://www.qr-code-generator.com/)
   - Print and display in church
4. **Sunday Bulletin**: Include the link
5. **Email Newsletter**: Add the form link

**Sample message:**
```
🙏 Prayer Request Form
Submit your prayer requests confidentially through our online form. 
Our pastoral team lifts you up in prayer.

[Your Google Form Link]

You can submit anonymously if you prefer.
```

---

## Security Notes

✅ **Google Form responses are private** - only people with Sheet access can see them
✅ **CMS access is restricted** - only authenticated staff can view prayer requests
✅ **Anonymous submissions** - names can be hidden in the CMS
✅ **API Key is secure** - stored in Supabase Edge Function secrets, never exposed to frontend
✅ **Deduplication** - prevents the same response from being imported twice

---

## Support

If you need help:
1. Check Supabase Edge Function logs for errors
2. Verify Google Sheet has the correct columns
3. Test the sync manually with "Sync Now" button
4. Check browser console for frontend errors
