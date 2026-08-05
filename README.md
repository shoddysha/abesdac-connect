# ABESDAC_Connect

A church management system built for **Abeka SDA Church** — manage members, ministries, attendance, events, announcements, reports, users, and audit logs from one secure, real-time web app.

This README assumes you are a **complete beginner**. Follow the steps in order and you'll have a working app.

---

## Table of contents

1. [What this app does](#what-this-app-does)
2. [Technologies used](#technologies-used)
3. [Before you start](#before-you-start)
4. [Step 1 — Create your Supabase project](#step-1--create-your-supabase-project)
5. [Step 2 — Run the database schema](#step-2--run-the-database-schema)
6. [Step 3 — Confirm storage buckets](#step-3--confirm-storage-buckets)
7. [Step 4 — Configure authentication](#step-4--configure-authentication)
8. [Step 5 — Install and run the app locally](#step-5--install-and-run-the-app-locally)
9. [Step 6 — Create your first administrator account](#step-6--create-your-first-administrator-account)
10. [Adding new users](#adding-new-users)
11. [Understanding roles and permissions](#understanding-roles-and-permissions)
12. [Using Excel import](#using-excel-import)
13. [Row Level Security explained](#row-level-security-explained)
14. [Deployment](#deployment)
15. [Troubleshooting / common errors](#troubleshooting--common-errors)
16. [Project structure](#project-structure)

---

## What this app does

ABESDAC_Connect lets church administrators and secretaries manage:

- **Members** — full profiles, search/filter, archive, Excel import with photos
- **Ministries** — create ministries, assign leaders and members
- **Attendance** — check-in/out for Sabbath services, midweek services, and events, with attendance percentages
- **Events** — calendar view, create/edit/delete
- **Announcements** — pin important updates
- **SMS** — bulk messaging, recurring service reminders, and message history
- **SMS Notifications** — send bulk SMS to members for events and announcements (via Arkesel)
- **Reports** — member/attendance/ministry statistics with CSV, Excel, and PDF export
- **Users** — role-based access control (Administrator, Secretary, Pastor, Ministry Leader)
- **Audit logs** — every important action is recorded automatically

Everything updates **live** — if one secretary edits a member's record, every other signed-in user sees the change instantly, with no page refresh.

---

## Technologies used

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| Data fetching/cache | TanStack Query |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Icons | Lucide |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Row Level Security) |

There is **no separate Node.js backend** — the React app talks directly and securely to Supabase.

---

## Before you start

You will need:

- A free [Supabase](https://supabase.com) account
- [Node.js](https://nodejs.org) version 18 or later installed on your computer
- A code editor (e.g. [VS Code](https://code.visualstudio.com))
- Basic comfort using a terminal (Command Prompt, PowerShell, or macOS/Linux Terminal)

---

## Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in.
2. Click **New project**.
3. Choose an organization, name the project (e.g. `abesdac-connect`), set a strong database password (**save this password somewhere safe**), and pick a region close to Ghana (e.g. Europe or Africa region if available).
4. Click **Create new project** and wait 1–2 minutes for it to finish provisioning.

---

## Step 2 — Run the database schema

1. In your Supabase project, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from this project in your code editor, copy **the entire file**, and paste it into the SQL Editor.
4. Click **Run** (or press Ctrl/Cmd + Enter).
5. You should see "Success. No rows returned." This creates all 8 tables, security rules, triggers, and storage buckets in one go.

> If you see an error, read [Troubleshooting](#troubleshooting--common-errors) below — the most common cause is running the script twice (some objects already exist, which is safe to ignore) or running only part of the file.

---

## Step 3 — Confirm storage buckets

The schema script already creates these buckets for you, but let's confirm:

1. Open **Storage** in the left sidebar.
2. You should see three buckets: `member-images`, `church-assets`, and `imports`.
3. If any are missing, click **New bucket** and create it manually (make `member-images` and `church-assets` **public**, and `imports` **private**), then re-run the storage policy section near the bottom of `schema.sql`.

---

## Step 4 — Configure authentication

1. Open **Authentication → Providers** and confirm **Email** is enabled (it is by default).
2. Open **Authentication → URL Configuration** and set:
   - **Site URL**: `http://localhost:5173` for now (you'll change this after deploying)
   - **Redirect URLs**: add `http://localhost:5173/reset-password` (add your production URL here too once deployed)
3. Optional but recommended: under **Authentication → Email Templates**, customize the "Reset Password" email with your church's name.

---

## Step 5 — Install and run the app locally

1. Open a terminal in this project's folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Open `.env` in your code editor and fill in your Supabase values. Find them in your Supabase project under **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   
   # Optional: Arkesel SMS Configuration (see Step 7)
   VITE_ARKESEL_API_KEY=your-arkesel-api-key
   VITE_ARKESEL_SENDER_ID=AbekaSDAChu
   ```
   > Use the **anon / public** key, never the `service_role` key, in this file — the anon key is safe to expose in a browser app because all access is controlled by Row Level Security.
5. Start the app:
   ```bash
   npm run dev
   ```
6. Open the URL shown in the terminal (usually `http://localhost:5173`).

You'll land on the **Login** page. You don't have an account yet — that's the next step.

---

## Step 6 — Create your first administrator account

Because this app has no separate backend server, the very first account is created directly in Supabase:

1. In Supabase, open **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter your email and a password. Leave "Auto Confirm User" checked so you don't need to verify by email.
4. Click **Create user**. This automatically creates a matching row in the `profiles` table (via a database trigger) with the default role `secretary`.
5. Go back to **SQL Editor** and run (replacing the email):
   ```sql
   update public.profiles set role = 'administrator' where email = 'you@example.com';
   ```
6. Go to the app and log in with that email and password. You now have full administrator access.

---

## Step 7 — Configure SMS (Secure Edge Function Approach)

The app includes SMS notification functionality via [Arkesel](https://sms.arkesel.com/), with your API key securely hidden using Supabase Edge Functions.

### Prerequisites:

1. **Supabase CLI installed:**
   ```bash
   npm install -g supabase
   ```

2. **Arkesel account with API key:**
   - Sign up at [sms.arkesel.com](https://sms.arkesel.com/)
   - Purchase SMS credits
   - Get your API key from dashboard

### Setup (5 steps):

**Step 1: Deploy Edge Function**
```bash
# Login to Supabase
supabase login

# Link your project (get ref ID from Supabase Dashboard → Settings)
supabase link --project-ref your-project-reference-id

# Deploy the function
supabase functions deploy send-sms
```

**Step 2: Store API Key Securely**
```bash
# Set your Arkesel credentials as secrets
supabase secrets set ARKESEL_API_KEY=your-actual-api-key
supabase secrets set ARKESEL_SENDER_ID=AbekaSDAChu
```

**Step 3: Update Local .env**
Your `.env` file should ONLY have Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**No Arkesel credentials needed in .env!** They're securely stored in Supabase.

**Step 4: Test Locally**
```bash
npm run dev
```
- Login as administrator or secretary
- Go to Events → Click SMS button
- Send test SMS

**Step 5: Deploy to Vercel**
Your Vercel environment variables should ONLY have:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**No Arkesel variables needed!**

### Detailed Instructions:
- See `SMS_SETUP_CHECKLIST.md` for step-by-step setup
- See `DEPLOY_SMS_EDGE_FUNCTION.md` for deployment guide
- See `SMS_TESTING_GUIDE.md` for testing & troubleshooting

### Security Benefits:
✅ API key never exposed in browser  
✅ API key never in your .env or Vercel  
✅ Double permission check (RLS + Edge Function)  
✅ Centralized logging in Supabase  

---

## Adding new users

Once you have an administrator account, add teammates the same way:

1. **Supabase Studio → Authentication → Users → Add user** — enter their email and a temporary password (or send them a magic invite using Supabase's invite feature if you prefer).
2. Their profile is created automatically with the default role of **Secretary**.
3. In the app, go to **User Management** (visible to administrators only) and change their role to Administrator, Secretary, Pastor, or Ministry Leader.
4. Share their login email and temporary password with them, and tell them to use **Forgot password** on first login to set their own password.

---

## Understanding roles and permissions

| Role | Members | Ministries | Attendance | Events | Reports | Announcements | User management |
|---|---|---|---|---|---|---|---|
| **Administrator** | Full access | Full access | Full access | Full access | View | Full access | Full access |
| **Secretary** | Full access | Full access | Full access | Full access | — | Full access | — |
| **Pastor** | View only | View only | View only | View only | View | View only | — |
| **Ministry Leader** | Edit members in their own ministry | Manage their own ministry's roster | Record attendance for their ministry's members | View only | — | View only | — |

These rules are enforced **twice**: once in the interface (so people don't see buttons they can't use) and once in the database itself via Row Level Security — so even a technically savvy user cannot bypass the rules by inspecting network requests.

---

## Using Excel import

From the **Members** page, click **Import** (visible to Administrators and Secretaries):

1. **Download the template** to see the exact column headers expected (First Name, Last Name, Date of Birth, Gender, Marital Status, Occupation, Nationality, Phone, Alternate Phone, Email, Residential Address, GPS Address, Baptism Date, Date Joined, District, Ministry, Status, Spouse, Children, Emergency Contact, Emergency Contact Phone, Image). Column names are matched flexibly — "First Name" and "first_name" both work.
2. Fill in your spreadsheet (.xlsx, .xls, or .csv all work) and upload it.
3. **Optional:** select all member photo files at once. Each photo's file name must exactly match the value in the spreadsheet's "Image" column (e.g. `john.jpg`).
4. Review the preview table — rows with problems are highlighted in red with the specific error shown. Click directly into any cell to fix it.
5. Click **Import**. The app uploads each photo to Supabase Storage, matches it to the right member, and creates the member records — showing progress as it goes.
6. You'll see a summary of how many members were imported successfully and any that failed.

---

## Using SMS notifications

Administrators and Secretaries can send bulk SMS to members (requires [Arkesel configuration](#step-7--configure-sms-optional)):

### From Events:
1. Create or open an event
2. Click the **Send SMS** button
3. Write your message (e.g., "Join us for Youth Fellowship on Saturday at 3pm!")
4. Choose recipients:
   - **All members**: Send to everyone with a phone number
   - **Specific ministry**: Filter by ministry (e.g., only Youth Ministry)
   - **Selected members**: Manually pick individuals
5. **Optional**: Check "Schedule reminder" to send an automatic reminder 24 hours before the event
6. Review the recipient count and click **Send**

### From Announcements:
1. Create or open an announcement
2. Click **Send SMS**
3. The announcement text is pre-filled (you can edit it)
4. Choose recipients (same options as events)
5. Click **Send**

### View SMS history:
- Go to **Settings → SMS Logs** to see all sent messages
- Click any log to see individual recipients and delivery status
- Failed messages show the reason (invalid phone number, insufficient balance, etc.)

### Manage scheduled SMS:
- Go to **Settings → Scheduled SMS**
- View all upcoming reminders
- Edit the message or recipient list
- Cancel a scheduled SMS before it sends

### Tips:
- Keep messages under 160 characters to avoid splitting into multiple SMS (which costs more)
- Phone numbers are automatically validated — members without valid phone numbers are skipped
- The app shows a confirmation with cost estimate before sending
- Test with a small group first (e.g., only your ministry) before sending to all members

---

## Row Level Security explained

Row Level Security (RLS) is a PostgreSQL feature that Supabase uses to control **exactly which rows** a signed-in user can see or change — enforced by the database itself, not just by the app's interface.

In `supabase/schema.sql` you'll find policies like:

```sql
create policy "members_write_admin_secretary" on public.members
  for all using (public.current_role() in ('administrator', 'secretary'))
  with check (public.current_role() in ('administrator', 'secretary'));
```

This means: only users whose `profiles.role` is `administrator` or `secretary` can insert, update, or delete rows in the `members` table — no matter what request the browser sends. Every table in this app has RLS **enabled**, and every policy is defined in the schema file, so you always know exactly who can do what.

If you ever need to add a new role or change permissions, edit the policies in `schema.sql` and re-run just that section in the SQL Editor.

---

## Deployment

### Deploy the frontend to Vercel

1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), sign in, and click **Add New → Project**.
3. Import your GitHub repository.
4. Vercel will detect it's a Vite app automatically. Leave the build settings as default (`npm run build`, output directory `dist`).
5. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_CHURCH_NAME`
   (same values as your local `.env` file)
6. Click **Deploy**. After a minute, you'll get a live URL like `https://abesdac-connect.vercel.app`.
7. **If using SMS**: Add your Arkesel credentials to Vercel's environment variables:
   - `VITE_ARKESEL_API_KEY`
   - `VITE_ARKESEL_SENDER_ID`

### Connect your production URL back to Supabase

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL.
3. Add `https://your-app.vercel.app/reset-password` to **Redirect URLs**.
4. Save.

### Custom domain (optional)

In Vercel, go to your project → **Settings → Domains** and add your church's domain (e.g. `connect.abekasda.org`), then follow Vercel's DNS instructions with your domain registrar.

### The backend needs no separate deployment

Supabase is already a hosted, production backend — there is nothing else to deploy. Just keep your Supabase project on a paid plan if your church grows past the free tier's limits (database size, monthly active users, storage).

---

## Troubleshooting / common errors

**"Missing Supabase environment variables" error on startup**
Your `.env` file is missing or not filled in. Copy `.env.example` to `.env` and add your project URL and anon key, then restart `npm run dev`.

**Login says "Invalid login credentials"**
Double check the email and password. If you just created the user in Supabase Studio, make sure "Auto Confirm User" was checked, or confirm the user's email manually under Authentication → Users.

**I can log in but see "Access restricted" on every page**
Your account's `profiles.role` might not be set correctly, or your profile row wasn't created. Run this in SQL Editor to check:
```sql
select id, email, role, is_active from public.profiles where email = 'you@example.com';
```
If no row exists, the trigger that auto-creates profiles didn't fire — re-run the `handle_new_user` function and trigger section of `schema.sql`, then create the user again.

**Images don't appear after importing members**
Confirm the photo file names exactly match the "Image" column values in your spreadsheet (case matters on some systems), and confirm the `member-images` bucket is set to **public** in Supabase Storage.

**"new row violates row-level security policy" error**
You're signed in with a role that isn't allowed to perform that action (e.g. a Pastor trying to edit a member). This is expected — RLS is working correctly. Sign in with an Administrator or Secretary account instead.

**Real-time updates aren't showing up in another browser tab**
Confirm Realtime is enabled for the relevant table: Supabase → Database → Replication, and check that the table is listed under the `supabase_realtime` publication (the schema script already adds all necessary tables — this is just for double-checking).

**Excel import says a row has errors I can't see the reason for**
Widen your browser window or scroll the preview table right — the "Issues" column on the far right lists the exact validation problem for that row.

**Build fails on Vercel**
Make sure all environment variables are set in Vercel's project settings (at minimum VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY; optionally VITE_ARKESEL_API_KEY and VITE_ARKESEL_SENDER_ID if using SMS), then trigger a new deployment.

**SMS isn't working / "Arkesel API key is not configured" error**
Your `.env` file is missing `VITE_ARKESEL_API_KEY` or it's not set correctly. Copy the key from your Arkesel dashboard, add it to `.env`, and restart `npm run dev`. For production, add it to your Vercel environment variables.

**SMS sending fails with "Invalid phone number"**
The app expects Ghana phone numbers in format 0XXXXXXXXX (10 digits starting with 0) or 233XXXXXXXXX (12 digits). Update the member's phone number in their profile to match this format.

**SMS sent successfully but members didn't receive it**
Check your Arkesel dashboard to confirm your account has sufficient SMS credits. Also verify the sender ID "AbekaSDAChu" is approved in your Arkesel account (some accounts require sender ID registration).

**Scheduled SMS didn't send at the scheduled time**
The app currently requires a manual trigger or backend process to check and send scheduled SMS. See the `processPendingScheduledSms` function in `src/services/sms.ts` — you can set up a cron job or Supabase Edge Function to call this periodically.

---

## Project structure

```
src/
  components/     Reusable UI (Button, Input, Modal, layout, etc.)
  pages/          One file per screen (Dashboard, Members, Ministries, ...)
  layouts/        AppLayout — sidebar + topbar shell wrapping every page
  hooks/          Reusable hooks (useRealtimeQuery)
  services/       All Supabase queries, grouped by feature (members.ts, events.ts, ...)
  lib/            Supabase client setup
  types/          TypeScript types mirroring the database schema
  utils/          Small helpers (className merge, CSV/Excel/PDF export)
  contexts/       AuthContext — session, profile, and role helpers
  features/       Self-contained features like the Excel import flow
supabase/
  schema.sql      The entire database: tables, RLS policies, triggers, storage buckets
```

---

Built for Abeka SDA Church. 🙏
