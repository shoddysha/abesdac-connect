import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  HelpCircle, Book, Mail, Phone, FileText, Video,
  ChevronDown, ChevronRight, Calendar, CheckCircle, Eye,
  Users, HeartHandshake, ClipboardCheck, CalendarDays,
  Megaphone, UserPlus2, BarChart3, Settings, MessageSquare,
  Shield, UserCog, Rocket, Zap, Heart, ArrowRight,
} from 'lucide-react';
import { Spinner, EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeQuery } from '@/hooks/useRealtimeQuery';
import {
  fetchVideoTutorials,
  fetchFAQs,
  fetchFAQCategories,
  incrementFAQView,
  incrementVideoView,
  type VideoTutorial,
} from '@/services/help';
import { Modal } from '@/components/ui/Modal';
import { YouTubePreview } from '@/components/YouTubePreview';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';

// ── Built-in system guide data (accurate to this app) ─────────────────────
interface GuideCard {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  badge: string;
  badgeColor: string;
}

const SYSTEM_GUIDES: GuideCard[] = [
  {
    icon: Users,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Managing Church Members',
    summary: 'Add, edit, search and manage member profiles including status, ministry assignment and follow-up tracking.',
    badge: 'Members',
    badgeColor: 'blue',
    category: 'People',
    content: `How to Manage Members

ADDING A MEMBER
1. Go to Members from the sidebar.
2. Click "+ Add Member" in the top-right.
3. Fill in the member's first name, last name, phone number, date of birth, gender, status and ministry.
4. Click Save. The member is immediately added to the system.

EDITING A MEMBER
1. Find the member using the search bar or scroll the list.
2. Click the edit (pencil) icon on the member card.
3. Update any field and click Save Changes.

MEMBER STATUS
• Active — Current, attending member.
• Inactive — Member no longer regularly attending.
• Archived — Member record hidden from main list but preserved.

GRID vs LIST VIEW
Toggle between Grid (9 per page) and List view (10 per page) using the view icons at the top right.

PAGINATION
Use the Previous / Next buttons or page numbers at the bottom to navigate.

MEMBER FOLLOW-UP
Members marked for follow-up appear in the Member Follow-ups page. Ministry leaders and admins receive notification badges when follow-ups are pending.`,
  },
  {
    icon: HeartHandshake,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'Ministries & Ministry Leaders',
    summary: 'Create ministries, assign leaders, manage members within each ministry and submit monthly reports.',
    badge: 'Ministries',
    badgeColor: 'purple',
    category: 'People',
    content: `How to Manage Ministries

CREATING A MINISTRY
1. Go to Ministries from the sidebar.
2. Click "+ New Ministry".
3. Enter the ministry name, description, and assign a leader.
4. Upload a ministry logo (optional).
5. Click Save.

MINISTRY MEMBERS
1. Click "View Details" on any ministry card.
2. Under the Members tab, click "+ Add Member" to assign existing members to the ministry.
3. To remove a member, click the remove icon next to their name.

SORT & FILTER
Use the Sort filter (Name / Members / Recent) to order the ministry list.
Pagination shows 9 ministries per page.

MINISTRY LEADER ACCESS
Ministry leaders have a dedicated "My Ministry" dashboard showing their ministry's members, upcoming events and report deadlines.

MINISTRY REPORTS
Leaders submit monthly/quarterly reports via Submit Reports in the sidebar.
Admins review and acknowledge reports from All Ministry Reports.`,
  },
  {
    icon: ClipboardCheck,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Recording Attendance',
    summary: 'Record service attendance, QR check-ins and track attendance trends over time.',
    badge: 'Attendance',
    badgeColor: 'green',
    category: 'Activities',
    content: `How to Record Attendance

MANUAL ATTENDANCE
1. Go to Attendance from the sidebar.
2. Click "+ New Attendance Record".
3. Choose the service date, service type and select attending members.
4. Click Save Record.

QR CODE CHECK-IN
1. On the Attendance page click "QR Check-in".
2. Display the QR code on a screen at the entrance.
3. Members scan using their phone camera.
4. Their attendance is recorded automatically.

VIEWING RECORDS
Attendance records are grouped by date. Use the date filter to narrow down records.

ATTENDANCE TRENDS
The Dashboard shows a 6-month attendance trend chart. The chart updates in real time as records are added.

REPORTS
The Reports page includes detailed attendance analytics grouped by month, ministry and service type.`,
  },
  {
    icon: CalendarDays,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Creating & Managing Events',
    summary: 'Create church events, assign organizing ministry, switch between list and calendar views.',
    badge: 'Events',
    badgeColor: 'amber',
    category: 'Activities',
    content: `How to Manage Events

CREATING AN EVENT
1. Go to Events from the sidebar.
2. Click "+ New Event".
3. Fill in the event title, date, time, location and description.
4. Select the "Organized by" ministry from the dropdown (fetches all active ministries).
5. Click Save.

CALENDAR vs LIST VIEW
Toggle between List and Calendar views using the tabs at the top.
• List view — shows events in chronological order with details.
• Calendar view — shows events on a monthly calendar grid.

EDITING AN EVENT
Click the edit icon on any event card to update details.

DELETING AN EVENT
Click the delete (trash) icon on the event card and confirm.

UPCOMING EVENTS
Upcoming events appear on the Dashboard and in the Topbar quick stats. The topbar shows the count of events from today onwards.

SEND SMS REMINDER
From an event, admins/secretaries can send an SMS reminder to all members or a specific ministry.`,
  },
  {
    icon: Megaphone,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    title: 'Announcements & Broadcasts',
    summary: 'Create, publish or draft announcements. Broadcast to all members via SMS. Track who has viewed each one.',
    badge: 'Announcements',
    badgeColor: 'red',
    category: 'Communication',
    content: `How to Manage Announcements

CREATING AN ANNOUNCEMENT
1. Go to Announcements from the sidebar.
2. Click "+ New Announcement".
3. Enter the title and message body.
4. Choose a status:
   • Publish Now — visible to all users immediately.
   • Save as Draft — only visible to admins.
5. Optionally pin the announcement to keep it at the top.
6. Click Publish Announcement or Save as Draft.

FILTERING
Use the tabs (All / Published / Draft / Archived) to filter the list.

ARCHIVING
Click the Archive icon to move a published announcement to the Archived tab.

PINNING
Pinned announcements appear with an "Important" badge and stay at the top of the list.

SMS BROADCAST
For important announcements, admins can send an SMS to all members or targeted groups directly from the announcement.

MARK AS READ
Members see a "New" badge on unread announcements. Clicking the eye icon marks it as read.`,
  },
  {
    icon: UserPlus2,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Visitor Tracking & Follow-up',
    summary: 'Record first-time visitors, track follow-up status and promote visitors to full members.',
    badge: 'Visitors',
    badgeColor: 'amber',
    category: 'People',
    content: `How to Manage Visitors

ADDING A VISITOR
1. Go to Visitors from the sidebar.
2. Click "+ Add Visitor".
3. Enter the visitor's name, phone, visit date, and how they heard about the church.
4. Click Save.

FOLLOW-UP TRACKING
Visitors without a follow-up contact are flagged on the Dashboard with an alert card. The notification bell also shows a count.

MARK AS FOLLOWED UP
1. Find the visitor in the list.
2. Click "Mark as Followed Up" to clear the pending status.

PROMOTE TO MEMBER
When a visitor decides to join the church:
1. Click "Promote to Member" on the visitor's record.
2. Fill in any additional member details.
3. Click Promote. The visitor is removed from the visitor list and added as a full member.

VISITOR REPORTS
The Reports page includes visitor statistics showing conversion rates and visit trends by month.`,
  },
  {
    icon: MessageSquare,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    title: 'SMS & Notifications',
    summary: 'Send bulk SMS to all members or target ministries. Schedule recurring reminders. View SMS logs.',
    badge: 'SMS',
    badgeColor: 'blue',
    category: 'Communication',
    content: `How to Use SMS & Notifications

SENDING A BULK SMS
1. Go to SMS & Notifications from the sidebar.
2. Choose recipients: All Members, By Ministry, or Select Members.
3. Type your message (up to 500 characters).
4. Click Send SMS. A confirmation shows how many recipients will receive the message.

SMS RECIPIENT COUNT
The system counts only active, non-archived members with valid phone numbers.

SCHEDULED SMS
Set up recurring SMS reminders (e.g., weekly service reminders) using the Scheduled SMS tab.

SMS LOGS
View the history of all sent SMS messages including delivery status and timestamp in the Logs tab.

NOTIFICATION BELL
The notification bell in the topbar shows counts for:
• Unread announcements
• Pending member follow-ups
• Unacknowledged ministry reports
• Upcoming report deadlines (ministry leaders)

Click any notification to navigate directly to the relevant page.`,
  },
  {
    icon: BarChart3,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: 'Reports & Analytics',
    summary: 'View member statistics, attendance trends, ministry performance, and generate exportable reports.',
    badge: 'Reports',
    badgeColor: 'blue',
    category: 'Management',
    content: `How to Use Reports

ACCESSING REPORTS
Go to Reports from the sidebar. Available to Administrators and Pastors only.

AVAILABLE REPORTS
• Member Statistics — total, active, male/female breakdown, new members by month.
• Attendance Analytics — monthly trends, by service type, by ministry.
• Ministry Reports — submitted reports from all ministries, acknowledgement status.
• Visitor Analytics — visitor count, follow-up rate, member conversion.
• Financial Summary — ministry budget requests and approvals.

EXPORTING DATA
Most report tables have an Export CSV button in the top-right to download the data.

AUDIT LOGS
Administrators can view all system activity in the Audit Logs page including user actions, record changes and system events. Logs support search, module filter and status filter. Pagination shows 15 entries per page.

DASHBOARD CHARTS
The Dashboard shows live charts including:
• Members by Ministry (bar chart)
• Attendance Rate — 6 month trend (area chart)
• Gender Distribution (donut chart)`,
  },
  {
    icon: UserCog,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    title: 'User Management',
    summary: 'Add system users, assign roles, manage access levels and reset passwords.',
    badge: 'Users',
    badgeColor: 'blue',
    category: 'Management',
    content: `How to Manage Users

ADDING A USER
1. Go to User Management from the sidebar (Administrators only).
2. Click "+ Add User".
3. Enter the user's full name, email, phone, role and a temporary password.
4. Click Add User. The user can immediately log in with the provided credentials.

USER ROLES
• Administrator — Full access to all features.
• Secretary — Can manage members, events, announcements and SMS.
• Pastor — Can view reports and prayer requests.
• Ministry Leader — Can manage their ministry, submit reports and record attendance.
• Member — Basic access to view their own profile and announcements.

EDITING A USER
Click the edit icon on any user to update their name, phone or role.

DEACTIVATING A USER
Toggle the "Active" status on a user to prevent them from logging in.

SECURITY
User passwords are encrypted using bcrypt. Administrators cannot view passwords.
The system automatically logs out users after 30 minutes of inactivity.`,
  },
  {
    icon: Settings,
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-600',
    title: 'Settings & Church Profile',
    summary: 'Update church details, manage your profile, notification preferences, and system backup.',
    badge: 'Settings',
    badgeColor: 'slate',
    category: 'Management',
    content: `How to Use Settings

CHURCH PROFILE (Admin only)
1. Go to Settings from the sidebar.
2. The Church tab shows church name, code, pastor, phone, email, address and website.
3. Click "Edit" to update any field.
4. Click "Save Changes".

Changes to the church phone and email are reflected in the Help & Support contact cards immediately.

YOUR PROFILE
1. Go to Settings → Profile tab.
2. Update your display name, phone number or upload a new profile photo.
3. Click Save.

CHANGING PASSWORD
1. Go to Settings → Security tab.
2. Enter your new password and confirm it.
3. Click Change Password.

NOTIFICATION PREFERENCES
1. Go to Settings → Notifications tab.
2. Toggle on/off different notification types.
3. Changes are saved automatically.

BACKUP & RESTORE
Administrators can generate a full system backup (JSON) from the Backup tab. Backup files can be used to restore data in case of emergency.`,
  },
];

// ── Release notes — accurate to current system version ───────────────────
const RELEASE_NOTES = [
  {
    version: '4.1.0',
    date: 'August 31, 2026',
    title: 'UI/UX Overhaul & Smart Features',
    description: 'Major interface redesign with new dashboard, collapsible sidebar, and improved data workflows.',
    features: [
      { title: 'New Dashboard', desc: 'Greeting header with auto quarter, 4 stat cards with sparklines, 3-column chart row (bar, area, donut) and real-time data.' },
      { title: 'Collapsible Sidebar', desc: 'Sidebar now collapses to icon-only mode on desktop. Tooltips appear on hover. All original colours and pages preserved.' },
      { title: 'Topbar Search', desc: 'Working page search in the topbar — type any page name and click to navigate. Shows full today\'s date.' },
      { title: 'Announcements Redesign', desc: 'New card-based layout with Published / Draft / Archived tabs. Users can choose to publish or save as draft.' },
      { title: 'Help & Support', desc: 'Complete User Guide with 10 built-in guide cards, church contact fetched from settings, and release notes.' },
    ],
    improvements: [
      { title: 'Audit Logs Pagination', desc: '15 rows per page with numbered page buttons, ellipsis and entry range display.' },
      { title: 'SMS Member Count', desc: 'Fixed recipient count to only include active, non-archived members with valid phone numbers.' },
      { title: 'Notification Modal', desc: 'New categorised notification panel with All / Unread / Announcement / Reports / Follow-ups / Attendance tabs.' },
      { title: 'Footer', desc: 'Credit footer added to every page: Designed & developed by NextGen_Developer.' },
    ],
    fixes: [
      { title: 'TypeScript Build Errors', desc: 'Fixed announcement content field, Input icon prop, Card id prop and Modal size prop across multiple components.' },
      { title: 'create_new_user Function', desc: 'Updated migration to drop existing function before recreating, fixing return type conflict error.' },
    ],
  },
  {
    version: '4.0.0',
    date: 'July 15, 2026',
    title: 'Real-time Engine & Feature Expansion',
    description: 'Migrated all queries to 10-second polling, added ministry logo upload, events calendar view, and QR check-in.',
    features: [
      { title: 'Events Calendar View', desc: 'Toggle between list and monthly calendar view. Events show organized-by ministry.' },
      { title: 'Ministries Pagination & Sort', desc: '9 per page with sort by Name, Members or Recent. Ministry logo upload UI added.' },
      { title: 'Members Pagination', desc: '9 per page in grid view, 10 per page in list view.' },
      { title: 'Audit Logs Redesign', desc: 'Stats cards (Total / Successful / Errors / Warnings), module and status filters, CSV export.' },
      { title: 'Settings Tabs', desc: 'Church profile, personal profile, notifications and security all in separate tabs with real-time DB sync.' },
    ],
    improvements: [
      { title: 'Dashboard Charts', desc: 'Sparklines on stat cards, attendance trend and gender distribution charts wired to live data.' },
      { title: 'User Management Grid', desc: 'Role tabs, stats cards, and AddUserModal using RPC function for immediate login.' },
    ],
    fixes: [
      { title: 'Duplicate Notification Button', desc: 'Removed notification button from dashboard header since it exists in the topbar.' },
    ],
  },
  {
    version: '3.0.0',
    date: 'May 1, 2026',
    title: 'Foundation Release',
    description: 'Initial production release of ABESDAC Connect with core church management features.',
    features: [
      { title: 'Member Management', desc: 'Full CRUD for church members with status tracking, ministry assignment and birthday reminders.' },
      { title: 'Ministry Management', desc: 'Create ministries, assign leaders, track members and submit reports.' },
      { title: 'Attendance Tracking', desc: 'Manual attendance recording and QR code check-in.' },
      { title: 'Events & Announcements', desc: 'Create church events and broadcast announcements with SMS integration.' },
      { title: 'SMS Notifications', desc: 'Bulk SMS to all members, by ministry, or selected individuals. Scheduled reminders.' },
      { title: 'Role-based Access', desc: 'Five user roles: Administrator, Secretary, Pastor, Ministry Leader, Member.' },
    ],
    improvements: [],
    fixes: [],
  },
];

export function HelpSupport() {
  const { profile } = useAuth();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'documentation' | 'videos' | 'faq' | 'releases'>('documentation');
  const [selectedGuide, setSelectedGuide] = useState<GuideCard | null>(null);
  const [previewTutorial, setPreviewTutorial] = useState<VideoTutorial | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────
  const videosQuery = useQuery({
    queryKey: ['video-tutorials'],
    queryFn: () => fetchVideoTutorials(),
  });

  const faqsQuery = useQuery({
    queryKey: ['faqs', selectedCategory],
    queryFn: () => selectedCategory === 'all' ? fetchFAQs() : fetchFAQs(selectedCategory),
  });

  const faqCategoriesQuery = useQuery({
    queryKey: ['faq-categories'],
    queryFn: fetchFAQCategories,
  });

  // Fetch church settings for contact cards
  const churchSettingsQuery = useQuery({
    queryKey: ['church-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('church_settings').select('phone, email, church_name').single();
      if (error) return null;
      return data;
    },
  });

  useRealtimeQuery('video_tutorials', ['video-tutorials']);
  useRealtimeQuery('faqs', ['faqs', selectedCategory]);
  useRealtimeQuery('church_settings', ['church-settings']);

  const videos = videosQuery.data || [];
  const faqs = faqsQuery.data || [];
  const faqCategories = faqCategoriesQuery.data || [];
  const churchSettings = churchSettingsQuery.data;

  // Group FAQs by category
  const groupedFaqs = useMemo(() => {
    const groups: Record<string, typeof faqs> = {};
    faqs.forEach(faq => {
      if (!groups[faq.category]) groups[faq.category] = [];
      groups[faq.category].push(faq);
    });
    return groups;
  }, [faqs]);

  // Filtered guide cards
  const filteredGuides = selectedCategory === 'all'
    ? SYSTEM_GUIDES
    : SYSTEM_GUIDES.filter(g => g.category === selectedCategory);

  const guideCategories = [...new Set(SYSTEM_GUIDES.map(g => g.category))];

  function toggleFaq(id: string) {
    setExpandedFaq(expandedFaq === id ? null : id);
    if (expandedFaq !== id) incrementFAQView(id);
  }

  const churchEmail = churchSettings?.email || null;
  const churchPhone = churchSettings?.phone || null;

  return (
    <div className="space-y-6">

      {/* ── Header with logo ─────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <img
          src="/abeka.png"
          alt="ABESDAC Logo"
          className="h-14 w-14 rounded-2xl bg-white border border-slate-200 shadow-sm object-contain p-1 flex-shrink-0"
        />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Help & Support</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {churchSettings?.church_name || 'ABESDAC Connect'} — Documentation & Guides
          </p>
        </div>
      </div>

      {/* ── Latest Release Banner ─────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 flex-shrink-0">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg">v{RELEASE_NOTES[0].version}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">Latest</span>
              </div>
              <p className="font-semibold">{RELEASE_NOTES[0].title}</p>
              <p className="text-sm text-blue-100 mt-0.5">{RELEASE_NOTES[0].description}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('releases')}
            className="flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white whitespace-nowrap flex-shrink-0"
          >
            View Details <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Contact Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 flex-shrink-0">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900">Email Support</h3>
            {churchEmail ? (
              <>
                <p className="text-sm text-slate-500 truncate mt-0.5">{churchEmail}</p>
                <a href={`mailto:${churchEmail}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-1 inline-block">
                  Send Email →
                </a>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-0.5 italic">Not set — update in Settings → Church Profile</p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 flex-shrink-0">
            <Phone className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900">Phone Support</h3>
            {churchPhone ? (
              <>
                <p className="text-sm text-slate-500 truncate mt-0.5">{churchPhone}</p>
                <a href={`tel:${churchPhone}`} className="text-sm font-medium text-green-600 hover:text-green-700 mt-1 inline-block">
                  Call Now →
                </a>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-0.5 italic">Not set — update in Settings → Church Profile</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {[
          { value: 'documentation', label: 'User Guide', icon: Book },
          { value: 'videos',        label: 'Video Tutorials', icon: Video },
          { value: 'faq',           label: 'FAQs', icon: HelpCircle },
          { value: 'releases',      label: 'Release Notes', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActiveTab(tab.value as any); setSelectedCategory('all'); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ───────────────────────────────────────────── */}
      <div className="min-h-[400px]">

        {/* ─ Documentation / User Guide ─ */}
        {activeTab === 'documentation' && (
          <div className="space-y-5">
            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn('px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                  selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
              >
                All
              </button>
              {guideCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn('px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                    selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Guide cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGuides.map((guide) => (
                <button
                  key={guide.title}
                  onClick={() => setSelectedGuide(guide)}
                  className="group text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Coloured icon */}
                    <div className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110', guide.iconBg)}>
                      <guide.icon className={cn('h-6 w-6', guide.iconColor)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Badge */}
                      <span className={cn(
                        'inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2',
                        guide.badgeColor === 'blue'   && 'bg-blue-100 text-blue-700',
                        guide.badgeColor === 'purple' && 'bg-purple-100 text-purple-700',
                        guide.badgeColor === 'green'  && 'bg-green-100 text-green-700',
                        guide.badgeColor === 'amber'  && 'bg-amber-100 text-amber-700',
                        guide.badgeColor === 'red'    && 'bg-red-100 text-red-700',
                        guide.badgeColor === 'slate'  && 'bg-slate-100 text-slate-600',
                        guide.badgeColor === 'cyan'   && 'bg-cyan-100 text-cyan-700',
                        guide.badgeColor === 'indigo' && 'bg-indigo-100 text-indigo-700',
                        guide.badgeColor === 'teal'   && 'bg-teal-100 text-teal-700',
                      )}>
                        {guide.badge}
                      </span>

                      <h4 className="font-semibold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">
                        {guide.title}
                      </h4>
                      <p className="text-sm text-slate-500 line-clamp-2">{guide.summary}</p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 flex-shrink-0 mt-1 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─ Video Tutorials ─ */}
        {activeTab === 'videos' && (
          <div>
            {videosQuery.isLoading ? (
              <Spinner />
            ) : videos.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No video tutorials yet"
                description="Video tutorials will appear here once they are uploaded in the Resources page."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => { incrementVideoView(video.id); setPreviewTutorial(video); }}
                  >
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-48 object-cover" />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
                        <Video className="h-12 w-12 text-purple-400" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {video.category}
                        </span>
                        {video.duration_minutes && (
                          <span className="text-xs text-slate-500">{video.duration_minutes} min</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-slate-900 line-clamp-2 mb-2">{video.title}</h4>
                      {video.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{video.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Eye className="h-3 w-3" />
                        <span>{video.view_count} views</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─ FAQs ─ */}
        {activeTab === 'faq' && (
          <div className="space-y-4">
            {faqCategories.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setSelectedCategory('all')}
                  className={cn('px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                    selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                  All
                </button>
                {faqCategories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)}
                    className={cn('px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                      selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {faqsQuery.isLoading ? <Spinner /> : faqs.length === 0 ? (
              <EmptyState icon={HelpCircle} title="No FAQs available yet" description="FAQs will be added soon." />
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedFaqs).map(([cat, catFaqs]) => (
                  <div key={cat}>
                    <h3 className="text-base font-semibold text-slate-900 mb-3">{cat}</h3>
                    <div className="space-y-2">
                      {catFaqs.map(faq => {
                        const isOpen = expandedFaq === faq.id;
                        return (
                          <div key={faq.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <button
                              onClick={() => toggleFaq(faq.id)}
                              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                            >
                              <div className="flex items-center gap-3">
                                <HelpCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                <span className="font-medium text-slate-900">{faq.question}</span>
                              </div>
                              {isOpen
                                ? <ChevronDown className="h-5 w-5 text-slate-400 flex-shrink-0" />
                                : <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />}
                            </button>
                            {isOpen && (
                              <div className="px-5 pb-4 border-t border-slate-100">
                                <p className="text-sm text-slate-600 mt-3 leading-relaxed whitespace-pre-line">{faq.answer}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─ Release Notes ─ */}
        {activeTab === 'releases' && (
          <div className="space-y-6">
            {RELEASE_NOTES.map((release, idx) => (
              <div key={release.version} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl',
                      idx === 0 ? 'bg-blue-600' : 'bg-slate-100'
                    )}>
                      {idx === 0
                        ? <Rocket className="h-6 w-6 text-white" />
                        : <Zap className="h-6 w-6 text-slate-500" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-slate-900">v{release.version}</span>
                        {idx === 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Latest</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-700">{release.title}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                    <Calendar className="h-3.5 w-3.5" />
                    {release.date}
                  </span>
                </div>

                <p className="text-sm text-slate-600 mb-5">{release.description}</p>

                <div className="space-y-4">
                  {release.features.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5" /> New Features
                      </h5>
                      <ul className="space-y-2">
                        {release.features.map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-600">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            <span><strong>{f.title}</strong> — {f.desc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {release.improvements.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Improvements
                      </h5>
                      <ul className="space-y-2">
                        {release.improvements.map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-600">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                            <span><strong>{f.title}</strong> — {f.desc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {release.fixes.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Heart className="h-3.5 w-3.5" /> Bug Fixes
                      </h5>
                      <ul className="space-y-2">
                        {release.fixes.map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-600">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                            <span><strong>{f.title}</strong> — {f.desc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── System Info ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">System Information</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            { label: 'Version',      value: 'v4.1.0' },
            { label: 'Your Role',    value: profile?.role?.replace('_', ' ') || '—' },
            { label: 'User ID',      value: profile?.id ? `${profile.id.slice(0, 8)}…` : '—' },
            { label: 'Last Updated', value: 'Aug 31, 2026' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">{item.label}</p>
              <p className="font-semibold text-slate-900 capitalize">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Guide Detail Modal ────────────────────────────────────── */}
      {selectedGuide && (
        <Modal
          open={!!selectedGuide}
          onClose={() => setSelectedGuide(null)}
          title={selectedGuide.title}
          size="xl"
        >
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0', selectedGuide.iconBg)}>
                <selectedGuide.icon className={cn('h-5 w-5', selectedGuide.iconColor)} />
              </div>
              <div>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  selectedGuide.badgeColor === 'blue'   && 'bg-blue-100 text-blue-700',
                  selectedGuide.badgeColor === 'purple' && 'bg-purple-100 text-purple-700',
                  selectedGuide.badgeColor === 'green'  && 'bg-green-100 text-green-700',
                  selectedGuide.badgeColor === 'amber'  && 'bg-amber-100 text-amber-700',
                  selectedGuide.badgeColor === 'red'    && 'bg-red-100 text-red-700',
                  selectedGuide.badgeColor === 'slate'  && 'bg-slate-100 text-slate-600',
                  selectedGuide.badgeColor === 'cyan'   && 'bg-cyan-100 text-cyan-700',
                  selectedGuide.badgeColor === 'indigo' && 'bg-indigo-100 text-indigo-700',
                  selectedGuide.badgeColor === 'teal'   && 'bg-teal-100 text-teal-700',
                )}>
                  {selectedGuide.category}
                </span>
              </div>
            </div>

            {/* Full content */}
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                {selectedGuide.content}
              </pre>
            </div>

            {/* Navigation between guides */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => {
                  const idx = SYSTEM_GUIDES.indexOf(selectedGuide);
                  if (idx > 0) setSelectedGuide(SYSTEM_GUIDES[idx - 1]);
                }}
                disabled={SYSTEM_GUIDES.indexOf(selectedGuide) === 0}
                className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-400">
                {SYSTEM_GUIDES.indexOf(selectedGuide) + 1} / {SYSTEM_GUIDES.length}
              </span>
              <button
                onClick={() => {
                  const idx = SYSTEM_GUIDES.indexOf(selectedGuide);
                  if (idx < SYSTEM_GUIDES.length - 1) setSelectedGuide(SYSTEM_GUIDES[idx + 1]);
                }}
                disabled={SYSTEM_GUIDES.indexOf(selectedGuide) === SYSTEM_GUIDES.length - 1}
                className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Tutorial Preview Modal ────────────────────────────────── */}
      {previewTutorial && (
        <Modal
          open={!!previewTutorial}
          onClose={() => setPreviewTutorial(null)}
          title={previewTutorial.title}
          size="xl"
        >
          <div className="space-y-4">
            <YouTubePreview
              url={previewTutorial.video_url}
              title={previewTutorial.title}
              autoplay
              className="aspect-video"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">
                {previewTutorial.category}
              </span>
              {previewTutorial.duration_minutes && (
                <span className="text-sm text-slate-600">{previewTutorial.duration_minutes} min</span>
              )}
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Eye className="h-3 w-3" /> {previewTutorial.view_count} views
              </span>
            </div>
            {previewTutorial.description && (
              <p className="text-sm text-slate-600">{previewTutorial.description}</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
