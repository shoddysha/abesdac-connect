# Prayer Requests - Simple Webhook Setup Guide

## 🚀 The Simplest Solution: Google Forms → Webhook → Supabase

**How it works:**
1. Church member fills Google Form
2. Google Form automatically sends data to Supabase webhook
3. Prayer request appears **instantly** in your CMS (no sync button needed!)

**Total setup time: 5 minutes**

---

## Step 1: Create Google Form (2 minutes)

### 1.1 Create the Form
1. Go to [forms.google.com](https://forms.google.com)
2. Click **+ Blank**
3. Title: **"Abeka SDA Church - Prayer Request"**

### 1.2 Add Questions (in this exact order)

**Question 1: Your Name**
- Type: Short answer
- Required: Yes

**Question 2: Prayer Request**
- Type: Paragraph
- Required: Yes

**Question 3: Submit Anonymously?**
- Type: Multiple choice
- Required: Yes
- Options:
  - No
  - Yes

### 1.3 Get the Form Link
1. Click **Send** button
2. Click **Link** icon
3. Click **Shorten URL**
4. **Copy this link** - share with church members

---

## Step 2: Deploy Supabase Webhook (1 minute)

### 2.1 Deploy the Edge Function

Open your terminal and run:

```bash
# Login to Supabase (if not already)
supabase login

# Link your project (if not already)
supabase link --project-ref your-project-ref

# Deploy the webhook function
supabase functions deploy receive-prayer-request
```

### 2.2 Get Your Webhook URL

After deployment, you'll see:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/receive-prayer-request
```

**Copy this URL** - you'll need it in the next step.

---

## Step 3: Connect Google Form to Webhook (2 minutes)

### 3.1 Open Apps Script
1. Open your Google Form
2. Click the **3 dots** menu (top right)
3. Click **Script editor**

### 3.2 Paste This Code

Delete any existing code and paste:

```javascript
// ========================================
// CONFIGURATION - UPDATE THIS URL
// ========================================

```

### 3.3 Update the Webhook URL
Replace `YOUR_PROJECT_REF` with your actual Supabase project reference.

### 3.4 Save the Script
Click the **disk icon** or press `Ctrl+S` (Windows) / `Cmd+S` (Mac)

---

## Step 4: Create the Trigger (30 seconds)

### 4.1 Add Trigger
1. In Apps Script editor, click **Triggers** (clock icon on left sidebar)
2. Click **+ Add Trigger** (bottom right)

### 4.2 Configure Trigger
- **Choose function**: `onFormSubmit`
- **Choose event source**: `From form`
- **Choose event type**: `On form submit`
- Click **Save**

### 4.3 Authorize
- Google will ask for permissions
- Click **Review permissions**
- Choose your account
- Click **Advanced** → **Go to [Project Name] (unsafe)**
- Click **Allow**

Done! ✅

---

## Step 5: Test It! (1 minute)

### 5.1 Submit Test Prayer Request
1. Open your Google Form link
2. Fill out:
   - Name: "Test User"
   - Prayer Request: "This is a test request"
   - Anonymous: No
3. Click **Submit**

### 5.2 Check Your CMS
1. Login to your CMS
2. Go to **Prayer Requests** page
3. Your test request should appear **instantly**! ⚡

### 5.3 View Logs (Optional)
In Apps Script:
1. Click **Executions** (list icon on left)
2. See the webhook call log
3. Check for errors

---

## How Church Members Use It

**Super Simple:**
1. Click the form link (share via SMS, WhatsApp, QR code, website)
2. Fill name, prayer request, choose anonymous or not
3. Submit
4. Done! The pastoral team receives it instantly

**No login needed. No CMS access needed. Just a simple form.**

---

## Troubleshooting

### Prayer request not appearing in CMS?

**Check 1: Apps Script Logs**
1. In Apps Script editor → **Executions**
2. Look for errors in the latest run
3. Check if webhook was called

**Check 2: Webhook Response**
1. In Supabase Dashboard → **Edge Functions**
2. Click `receive-prayer-request`
3. Go to **Logs** tab
4. Check for errors

**Check 3: Database**
1. In Supabase Dashboard → **Table Editor**
2. Open `prayer_requests` table
3. Check if row was inserted

### Common Issues

**"Script authorization failed"**
- You need to authorize the script to run
- Follow Step 4.3 authorization steps again

**"Webhook URL not found"**
- Check you deployed the function: `supabase functions deploy receive-prayer-request`
- Verify the URL is correct in the Apps Script

**"Missing required fields"**
- Check the question order in your form matches the script
- The script expects: 1) Name, 2) Prayer Request, 3) Anonymous

**Duplicate requests**
- The webhook checks timestamps to prevent duplicates
- If you see duplicates, check `google_form_timestamp` column

---

## Advanced: Custom Form Questions

If you want different questions, update the Apps Script:

```javascript
// Example: 4 questions (Name, Email, Prayer, Anonymous)
const name = responses[0]?.getResponse() || '';
const email = responses[1]?.getResponse() || '';
const prayerRequest = responses[2]?.getResponse() || '';
const anonymous = responses[3]?.getResponse() || 'No';

const payload = {
  name: name,
  prayer_request: prayerRequest,
  anonymous: anonymous,
  // email: email, // Can add this if you want
  timestamp: new Date().toISOString()
};
```

---

## Sharing the Form

**Option 1: Direct Link**
Send via SMS/WhatsApp:
```
🙏 Prayer Request Form
[Your Google Form Link]

Submit your prayer requests here.
Our pastoral team will pray for you.
```

**Option 2: QR Code**
1. Generate at [qr-code-generator.com](https://www.qr-code-generator.com/)
2. Use your Google Form link
3. Print and display in church

**Option 3: Website Button**
```html
<a href="YOUR_FORM_LINK" target="_blank">
  Submit Prayer Request
</a>
```

---

## Benefits of This Approach

✅ **Instant** - No "Sync Now" button needed  
✅ **Simple** - Just 3 steps to set up  
✅ **No API Keys** - No Google Sheets API needed  
✅ **No Polling** - Real-time webhook delivery  
✅ **Reliable** - Google handles delivery  
✅ **Secure** - Direct to your database  
✅ **Free** - No paid services required  

---

## Security Notes

- The webhook is public (anyone can POST to it) - this is intentional for form submissions
- Rate limiting is handled by Supabase Edge Functions
- Duplicate prevention via timestamps
- No sensitive data is exposed
- Only INSERT permission needed (webhook can't read/update/delete)

---

## Files Needed

1. **`supabase/functions/receive-prayer-request/index.ts`** - The webhook function (already created)
2. **Apps Script code** - Paste into Google Form script editor (provided above)

That's it! Just 2 pieces of code.

---

## Comparison: API vs Webhook

| Feature | Google Sheets API | Webhook |
|---------|------------------|---------|
| Setup Time | 15 minutes | 5 minutes |
| API Keys Needed | Yes | No |
| Sync Method | Manual button | Instant |
| Google Cloud Setup | Yes | No |
| Complexity | Medium | Simple |
| Real-time | No | Yes |

**Webhook is the clear winner!** ✅

---

## Next Steps

1. ✅ Deploy webhook: `supabase functions deploy receive-prayer-request`
2. ✅ Get webhook URL
3. ✅ Create Google Form (3 questions)
4. ✅ Add Apps Script with webhook URL
5. ✅ Create trigger "On form submit"
6. ✅ Test with sample submission
7. ✅ Share form link with church members

Done! Prayer requests now flow instantly from Google Forms to your CMS. 🎉
