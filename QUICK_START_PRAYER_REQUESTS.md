# Prayer Requests - Quick Start Guide

## 🎯 What You Need

1. **Google Form** - Public form for church members
2. **Google Sheet** - Linked to form (auto-created)
3. **Google Sheets API Key** - From Google Cloud Console
4. **Supabase Edge Function** - To sync data
5. **Your CMS** - To view and manage requests

---

## ⚡ 5-Minute Setup

### Step 1: Create Google Form (2 min)
1. Go to [forms.google.com](https://forms.google.com)
2. Create form with 3 questions:
   - **Your Name** (short answer, required)
   - **Prayer Request** (paragraph, required)
   - **Submit Anonymously?** (multiple choice: "No, use my name" / "Yes, keep it anonymous")
3. Click **Responses** → Sheet icon to create linked spreadsheet
4. Copy the **form link** (to share with church)
5. Copy the **Sheet ID** from spreadsheet URL

### Step 2: Enable Google Sheets API (1 min)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google Sheets API**
3. Create **API Key** (Credentials → Create → API Key)
4. Copy the API key
5. Make spreadsheet public: **Share** → Anyone with link → **Viewer**

### Step 3: Configure Supabase (2 min)
1. Run SQL migration: `supabase/migrations/add_prayer_requests.sql`
2. Deploy function: `supabase functions deploy sync-prayer-requests`
3. Add secrets in Supabase Dashboard → Edge Functions → sync-prayer-requests → Secrets:
   - `GOOGLE_SHEETS_API_KEY` = your API key
   - `PRAYER_REQUESTS_SHEET_ID` = your Sheet ID

### Step 4: Update CMS Code (30 sec)
1. Open `src/pages/PrayerRequests.tsx`
2. Line ~111: Replace `https://forms.google.com/your-form-url` with your form link
3. Deploy: `git push`

### Step 5: Test (30 sec)
1. Submit test via Google Form
2. Click **Sync Now** in CMS Prayer Requests page
3. See your test request appear ✅

---

## 📋 The 3 Google Form Questions

```
Question 1: Your Name
Type: Short answer
Required: Yes

Question 2: Prayer Request  
Type: Paragraph
Required: Yes

Question 3: Submit Anonymously?
Type: Multiple choice
Options: 
  - No, use my name
  - Yes, keep it anonymous
Required: Yes
```

---

## 🔑 Where to Find Your IDs

### Google Sheet ID
```
https://docs.google.com/spreadsheets/d/1abc123xyz456/edit
                                         ^^^^^^^^^^^^^^
                                       This is the Sheet ID
```

### Supabase Project Ref
```
https://xxxxx.supabase.co
        ^^^^^
   Project Ref
```

Settings → API → Project URL

### Supabase Anon Key
Settings → API → Project API keys → anon public (starts with `eyJ...`)

---

## 🚀 Sharing with Church Members

**Option 1: Direct Link**
```
🙏 Submit Prayer Requests
https://forms.google.com/xxxxx

Our pastoral team will lift you up in prayer.
Submit anonymously if you prefer.
```

**Option 2: QR Code**
1. Generate at [qr-code-generator.com](https://www.qr-code-generator.com)
2. Print and display in church

**Option 3: Church Website**
Add button linking to your form

---

## 🔄 How Church Members Use It

1. Click form link
2. Enter name and prayer request
3. Choose anonymous or not
4. Submit
5. Done! ✅ (They're done, no CMS access needed)

---

## 👨‍💼 How Staff Use It (CMS)

1. Login to CMS
2. Go to **Prayer Requests** page
3. Click **Sync Now** to fetch new requests
4. View all prayer requests
5. Mark as "Ongoing" when praying
6. Mark as "Answered" with testimony notes

---

## ⚡ Want Instant Syncing?

**Instead of clicking "Sync Now", sync automatically when form is submitted:**

1. Open your Google Sheet
2. Go to **Extensions** → **Apps Script**
3. Copy code from `google-apps-script-trigger.js`
4. Update the 2 config values (Supabase URL and Anon Key)
5. Save and add trigger: "On form submit"

Now syncs instantly! ⚡

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "No new responses" | Check Google Sheet has data, verify column order |
| "Missing configuration" | Set both Edge Function secrets in Supabase |
| "API error 403" | Make Sheet public ("Anyone with link can view") |
| "Function not found" | Deploy Edge Function: `supabase functions deploy sync-prayer-requests` |

---

## 📁 Key Files

- `GOOGLE_FORMS_PRAYER_SETUP.md` - Full detailed guide
- `PRAYER_REQUESTS_INTEGRATION_SUMMARY.md` - Technical summary
- `google-apps-script-trigger.js` - Code for instant syncing
- `supabase/functions/sync-prayer-requests/index.ts` - Edge Function
- `supabase/migrations/add_prayer_requests.sql` - Database setup

---

## ✅ Checklist

- [ ] Created Google Form with 3 questions
- [ ] Got Sheet ID from linked spreadsheet
- [ ] Enabled Google Sheets API
- [ ] Got API Key
- [ ] Made Sheet publicly viewable
- [ ] Ran SQL migration in Supabase
- [ ] Deployed Edge Function
- [ ] Set 2 Edge Function secrets
- [ ] Updated form link in CMS code
- [ ] Deployed CMS to Vercel
- [ ] Tested: Submit form → Sync → See in CMS ✅

---

## 🎉 You're Done!

Share the Google Form link with your church and start receiving prayer requests automatically!

For detailed instructions, see: **GOOGLE_FORMS_PRAYER_SETUP.md**
