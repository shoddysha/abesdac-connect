# Prayer Requests Webhook - Quick Reference Card

## 🎯 Overview

**Google Form → Webhook → Supabase → CMS (Instant!)**

---

## ⚡ 5-Minute Setup

### 1️⃣ Deploy Webhook (1 min)
```bash
supabase functions deploy receive-prayer-request
```
**Output**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/receive-prayer-request`

Copy this URL ↑

---

### 2️⃣ Create Google Form (2 min)

**3 Questions (exact order):**

| # | Question | Type | Required |
|---|----------|------|----------|
| 1 | Your Name | Short answer | ✅ Yes |
| 2 | Prayer Request | Paragraph | ✅ Yes |
| 3 | Submit Anonymously? | Multiple choice (No / Yes) | ✅ Yes |

**Get form link** → Share with church members

---

### 3️⃣ Add Apps Script (2 min)

In Google Form → **⋮** (3 dots) → **Script editor** → Paste:

```javascript
const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';

function onFormSubmit(e) {
  try {
    const r = e.response.getItemResponses();
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        name: r[0]?.getResponse() || '',
        prayer_request: r[1]?.getResponse() || '',
        anonymous: r[2]?.getResponse() || 'No',
        timestamp: new Date().toISOString()
      }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log(e); }
}
```

Replace `YOUR_WEBHOOK_URL_HERE` with your webhook URL from step 1.

**Save** (Ctrl+S / Cmd+S)

---

### 4️⃣ Create Trigger (30 sec)

In Apps Script:
1. Click **⏰ Triggers** (left sidebar)
2. Click **+ Add Trigger**
3. Select:
   - Function: `onFormSubmit`
   - Event source: `From form`
   - Event type: `On form submit`
4. **Save** → Authorize

---

### 5️⃣ Update CMS (30 sec)

Edit `src/pages/PrayerRequests.tsx` line ~89:
```typescript
href="YOUR_GOOGLE_FORM_LINK_HERE"
```

Deploy:
```bash
git push
```

---

## ✅ Test

1. **Submit form** with test data
2. **Check CMS** → Prayer Requests page
3. Should appear **instantly**! ⚡

---

## 📋 Google Apps Script - Full Version

```javascript
// ========================================
// CONFIGURATION
// ========================================
const WEBHOOK_URL = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/receive-prayer-request';

// ========================================
// AUTO-SUBMIT TO WEBHOOK
// ========================================
function onFormSubmit(e) {
  try {
    const responses = e.response.getItemResponses();
    
    // Extract answers (order matches form questions)
    const name = responses[0]?.getResponse() || '';
    const prayerRequest = responses[1]?.getResponse() || '';
    const anonymous = responses[2]?.getResponse() || 'No';
    
    // Prepare data
    const payload = {
      name: name,
      prayer_request: prayerRequest,
      anonymous: anonymous,
      timestamp: new Date().toISOString()
    };
    
    // Send to webhook
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const result = JSON.parse(response.getContentText());
    
    Logger.log('✅ Success: ' + JSON.stringify(result));
    
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
  }
}
```

---

## 🔍 Where to Find IDs

### Supabase Project Ref
```
Dashboard → Settings → API → Project URL
https://xxxxx.supabase.co
        ^^^^^
   Project Ref
```

### Google Form Link
```
Form → Send → Link icon → Shorten URL → Copy
```

---

## 🐛 Troubleshooting

| Issue | Check |
|-------|-------|
| Not appearing in CMS | Apps Script → Executions → Check for errors |
| "Webhook not found" | Run: `supabase functions deploy receive-prayer-request` |
| "Authorization failed" | Apps Script → Re-authorize the script |
| Wrong data | Check question order matches script (1=Name, 2=Request, 3=Anonymous) |

---

## 📱 Share with Church

**Message Template:**
```
🙏 Submit Prayer Requests

[Your Google Form Link]

Our pastoral team will pray for you.
Submit anonymously if you prefer.

- Abeka SDA Church
```

**Share via:**
- SMS/WhatsApp
- QR Code (print in church)
- Website button
- Email/Bulletin

---

## 📊 Flow Diagram

```
Church Member
     ↓
Fills Google Form (3 questions)
     ↓
Clicks Submit
     ↓
Apps Script triggers
     ↓
POST to Webhook
     ↓
Supabase validates & saves
     ↓
Real-time subscription
     ↓
CMS updates instantly ⚡
```

---

## 🎁 Benefits

✅ **Instant** - Appears immediately, no sync button  
✅ **Simple** - 5-minute setup  
✅ **No API Keys** - No Google Cloud config  
✅ **Real-time** - Live updates in CMS  
✅ **Mobile-friendly** - Google Forms work on phones  
✅ **Anonymous** - Built-in privacy option  
✅ **Free** - Zero cost  

---

## 📚 Full Documentation

See: **WEBHOOK_PRAYER_SETUP.md**

---

## ✅ Checklist

- [ ] Deploy webhook function
- [ ] Create Google Form (3 questions)
- [ ] Add Apps Script code
- [ ] Update webhook URL in script
- [ ] Save script
- [ ] Create trigger "On form submit"
- [ ] Authorize script
- [ ] Update form link in CMS
- [ ] Deploy CMS
- [ ] Test with sample submission
- [ ] Share form link with church

**Done!** 🎉
