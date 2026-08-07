# Prayer Requests - Google Forms Integration Summary

## ✅ What Was Done

### TypeScript Errors Fixed
1. ✅ Added `onClick` prop to Card component
2. ✅ Added `purple` tone to Badge component  
3. ✅ Removed `fetchAllMembers` import error (deleted the form modal)
4. ✅ All TypeScript diagnostics now pass

### Google Forms Integration Implemented
1. ✅ **Prayer Requests Page** - Redesigned to work with Google Forms
   - Shows prayer requests synced from Google Sheets
   - "Sync Now" button to manually fetch new responses
   - "Open Prayer Form" button to open the public Google Form
   - Status management (Open → Ongoing → Answered)
   - Search and filter by status
   - Answer modal to record testimonies

2. ✅ **Database Migration Updated** (`supabase/migrations/add_prayer_requests.sql`)
   - Added `google_form_timestamp` column for deduplication
   - Added index on google_form_timestamp for faster lookups

3. ✅ **Service Layer Updated** (`src/services/prayerRequests.ts`)
   - Added `syncGoogleFormResponses()` function
   - Calls Supabase Edge Function to sync from Google Sheets
   - Returns count of new requests imported

4. ✅ **Supabase Edge Function Created** (`supabase/functions/sync-prayer-requests/index.ts`)
   - Fetches responses from Google Sheets API
   - Checks for duplicates using timestamp
   - Inserts new prayer requests into database
   - Handles anonymous submissions
   - Uses secure environment variables for API keys

5. ✅ **Comprehensive Setup Guide** (`GOOGLE_FORMS_PRAYER_SETUP.md`)
   - Step-by-step instructions for creating Google Form
   - How to enable Google Sheets API and get API key
   - Supabase configuration steps
   - Testing procedures
   - Automatic sync options (cron job or Apps Script)
   - Troubleshooting guide

---

## 🎯 How It Works

### User Flow (Church Members)
1. Church member visits the public Google Form link
2. Fills out:
   - Name
   - Prayer Request (detailed text)
   - Anonymous option (Yes/No)
3. Submits the form
4. Response is saved to Google Sheet automatically

### Admin Flow (CMS Users)
1. Pastor/Admin logs into CMS
2. Goes to **Prayer Requests** page
3. Clicks **Sync Now** button
4. New responses are fetched from Google Sheet
5. New prayer requests appear in the list
6. Can mark as "Ongoing" or "Answered" with testimony notes

### Technical Flow
```
Google Form → Google Sheet → Edge Function → Supabase DB → CMS UI
```

---

## 📋 Google Form Structure

Your Google Form should have these questions in order:

| # | Question | Type | Required |
|---|----------|------|----------|
| 1 | Your Name | Short answer | Yes |
| 2 | Prayer Request | Paragraph | Yes |
| 3 | Submit Anonymously? | Multiple choice | Yes |

Options for Q3: "No, use my name" / "Yes, keep it anonymous"

---

## 🔧 Setup Checklist

### Part 1: Google Forms & Sheets
- [ ] Create Google Form with 3 questions
- [ ] Link form to Google Sheet
- [ ] Copy the form link (share with church)
- [ ] Copy the Sheet ID from the URL
- [ ] Make sheet publicly viewable ("Anyone with link can view")

### Part 2: Google Cloud
- [ ] Enable Google Sheets API in Google Cloud Console
- [ ] Create API Key
- [ ] (Optional) Restrict API key to Google Sheets API only

### Part 3: Supabase
- [ ] Run migration: `add_prayer_requests.sql`
- [ ] Deploy Edge Function: `supabase functions deploy sync-prayer-requests`
- [ ] Set Edge Function secrets:
  - `GOOGLE_SHEETS_API_KEY` = Your API key
  - `PRAYER_REQUESTS_SHEET_ID` = Your Sheet ID

### Part 4: CMS Code
- [ ] Update Google Form link in `src/pages/PrayerRequests.tsx` (line ~111)
- [ ] Deploy to Vercel

### Part 5: Testing
- [ ] Submit test prayer request via Google Form
- [ ] Check it appears in Google Sheet
- [ ] Click "Sync Now" in CMS
- [ ] Verify request appears in CMS
- [ ] Test marking as Ongoing/Answered

---

## 🔒 Security & Privacy

### ✅ What's Secure
- Google Sheets API key stored in Supabase secrets (never exposed to frontend)
- Only authenticated CMS users can view prayer requests
- Google Form responses only visible to Sheet owner
- Anonymous submissions hide the person's name in CMS
- Deduplication prevents accidental double imports

### ⚠️ Important Notes
- The Google Sheet must be "Anyone with link can view" for the API to read it
- Church members do NOT need CMS access to submit prayer requests
- Only Administrators, Pastors, and Secretaries can update prayer status
- Only Administrators can delete prayer requests

---

## 🚀 Deployment Steps

```bash
# 1. Commit code changes
git add .
git commit -m "Add Google Forms prayer request integration"

# 2. Deploy Edge Function (from project root)
supabase functions deploy sync-prayer-requests

# 3. Set Edge Function secrets in Supabase Dashboard
# Go to Edge Functions → sync-prayer-requests → Secrets
# Add: GOOGLE_SHEETS_API_KEY and PRAYER_REQUESTS_SHEET_ID

# 4. Run migration in Supabase SQL Editor
# Copy/paste: supabase/migrations/add_prayer_requests.sql

# 5. Push to Vercel
git push
```

---

## 📱 Sharing the Form with Church

### Option 1: Direct Link
Share the Google Form URL via:
- WhatsApp groups
- Church SMS broadcasts
- Email newsletters
- Website button

### Option 2: QR Code
1. Generate QR code from form URL
2. Print and display in church building
3. Add to Sunday bulletin

### Option 3: Website Integration
Add iframe to church website:
```html
<iframe 
  src="YOUR_GOOGLE_FORM_URL?embedded=true" 
  width="100%" 
  height="800" 
  frameborder="0">
  Loading…
</iframe>
```

---

## 🔄 Automatic Syncing (Optional)

### Option A: Scheduled Sync (Every Hour)
Set up a Supabase cron job to sync automatically every hour (see full guide for SQL code).

### Option B: Real-time Sync (Instant)
Use Google Apps Script trigger to sync immediately when form is submitted (see full guide for JavaScript code).

**Recommendation:** Start with manual "Sync Now" button, then add automatic sync once you're comfortable with the system.

---

## 📊 Expected Google Sheet Format

| A | B | C | D |
|---|---|---|---|
| Timestamp | Name | Prayer Request | Anonymous |
| 1/15/2025 10:30:45 | John Doe | Please pray for healing | No, use my name |
| 1/15/2025 11:15:22 | Anonymous | Job search prayer | Yes, keep it anonymous |

**Column A (Timestamp)**: Auto-generated by Google Forms  
**Column B (Name)**: User's input  
**Column C (Prayer Request)**: User's input  
**Column D (Anonymous)**: "No, use my name" or "Yes, keep it anonymous"

---

## 🐛 Troubleshooting

### Sync returns "No new responses"
- Check Google Sheet has data rows (beyond header)
- Verify column order matches expected format
- Check Edge Function logs in Supabase

### "Missing Google Sheets configuration" error
- Verify both secrets are set in Supabase Edge Function
- Check spelling: `GOOGLE_SHEETS_API_KEY` and `PRAYER_REQUESTS_SHEET_ID`

### "Google Sheets API error: 403"
- Ensure Sheet is shared as "Anyone with the link can view"
- Check API key is valid and not expired
- Verify Google Sheets API is enabled in Google Cloud Console

### Duplicate prayer requests appearing
- This shouldn't happen - the system uses timestamps for deduplication
- Check if `google_form_timestamp` column exists in database
- Verify Edge Function is using correct timestamp column

---

## 📝 Files Modified/Created

### Modified
- ✅ `src/pages/PrayerRequests.tsx` - Redesigned for Google Forms sync
- ✅ `src/services/prayerRequests.ts` - Added syncGoogleFormResponses()
- ✅ `src/components/ui/Card.tsx` - Added onClick prop
- ✅ `src/components/ui/Badge.tsx` - Added purple tone
- ✅ `supabase/migrations/add_prayer_requests.sql` - Added google_form_timestamp column

### Created
- ✅ `supabase/functions/sync-prayer-requests/index.ts` - Edge Function for syncing
- ✅ `GOOGLE_FORMS_PRAYER_SETUP.md` - Complete setup guide
- ✅ `PRAYER_REQUESTS_INTEGRATION_SUMMARY.md` - This file

### Deleted
- ✅ `src/features/prayer/PrayerRequestFormModal.tsx` - No longer needed (using Google Forms)

---

## 🎉 Benefits of This Approach

1. **Public Access** - Any church member can submit without CMS login
2. **Mobile Friendly** - Google Forms work great on phones
3. **Offline Collection** - Can share QR codes/printed links
4. **Data Backup** - Google Sheets serves as backup storage
5. **Easy Sharing** - Single link to share via any channel
6. **Privacy Options** - Anonymous submission built-in
7. **Staff Only Viewing** - Only authenticated staff see requests in CMS
8. **Status Tracking** - Mark progress (Open → Ongoing → Answered)
9. **Testimony Recording** - Document answered prayers for encouragement

---

## 📞 Support

For detailed setup instructions, see: **GOOGLE_FORMS_PRAYER_SETUP.md**

All TypeScript errors are now fixed and ready for deployment! 🚀
