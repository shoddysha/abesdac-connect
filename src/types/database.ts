// Hand-written types that mirror supabase/schema.sql.
// If you change the schema, update this file (or generate it with
// `npx supabase gen types typescript` — see README).

export type UserRole = 'administrator' | 'secretary' | 'pastor' | 'ministry_leader';
export type MemberStatus = 'active' | 'inactive' | 'archived' | 'transferred' | 'deceased';
export type Gender = 'male' | 'female';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type AttendanceType = 'sabbath_service' | 'midweek_service' | 'event';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
export type SmsStatus = 'pending' | 'sent' | 'failed' | 'cancelled';
export type SmsType = 'event_notification' | 'event_reminder' | 'announcement' | 'manual';
export type VisitType = 'sabbath_service' | 'midweek_service' | 'event';
export type PrayerStatus = 'open' | 'ongoing' | 'answered';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ReportType = 'monthly' | 'quarterly' | 'annual' | 'special';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  notification_preferences: NotificationPreferences | null;
  display_preferences: DisplayPreferences | null;
  updated_preferences_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ministry {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Member {
  id: string;
  member_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  marital_status: MaritalStatus | null;
  occupation: string | null;
  nationality: string | null;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  residential_address: string | null;
  gps_address: string | null;
  baptism_date: string | null;
  date_joined: string;
  district: string | null;
  ministry_id: string | null;
  status: MemberStatus;
  spouse_name: string | null;
  children_names: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  profile_image_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface MinistryMember {
  id: string;
  ministry_id: string;
  member_id: string;
  joined_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  created_by_role: UserRole | null;
}

export interface Attendance {
  id: string;
  member_id: string;
  attendance_type: AttendanceType;
  event_id: string | null;
  service_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  module: string;
  record_id: string | null;
  description: string | null;
  created_at: string;
}

export interface SmsLog {
  id: string;
  type: SmsType;
  status: SmsStatus;
  event_id: string | null;
  announcement_id: string | null;
  message: string;
  recipient_count: number;
  successful_count: number;
  failed_count: number;
  arkesel_response: Record<string, any> | null;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface SmsRecipient {
  id: string;
  sms_log_id: string;
  member_id: string;
  phone_number: string;
  status: SmsStatus;
  arkesel_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface ScheduledSms {
  id: string;
  event_id: string;
  message: string;
  scheduled_for: string;
  status: SmsStatus;
  recipient_filters: RecipientFilters | null;
  created_by: string | null;
  sent_at: string | null;
  sms_log_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringServiceReminder {
  id: string;
  service_type: 'sabbath_service' | 'midweek_service' | 'sunday_bible_study';
  message: string;
  send_time: string;
  send_day_offset: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  email: string | null;
  visit_date: string;
  visit_type: VisitType;
  followed_up: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipientFilters {
  ministry_id?: string;
  all_members?: boolean;
  member_ids?: string[];
}

export interface ArkeselSmsResponse {
  code: string;
  message: string;
  data?: {
    status: string;
    message_id?: string;
  };
}

// Note: this file previously also exported a `Database` type meant to be
// passed as a generic to createClient<Database>(). It was removed because
// its shape didn't fully match what @supabase/supabase-js expects
// internally, which silently broke TypeScript's checking of every insert/
// update call across the app (all typed as `never`) without any warning
// at the type definition itself. src/lib/supabase.ts now creates an
// untyped client instead — every service function below already casts
// its results to these types explicitly (e.g. `as Member[]`), which is
// where the real type-safety comes from.

export interface MinistryTask {
  id: string;
  ministry_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MinistryReport {
  id: string;
  ministry_id: string;
  report_period: string;
  report_type: ReportType;
  event_id: string | null;
  title: string;
  summary: string | null;
  achievements: string | null;
  challenges: string | null;
  attendance_count: number | null;
  expenses: number | null;
  budget: number | null;
  future_plans: string | null;
  submitted_by: string | null;
  submitted_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledgement_note: string | null;
  created_at: string;
  updated_at: string;
}

// Member Follow-up Types
export type FollowUpType = 'pastoral_care' | 'new_member' | 'inactive' | 'sick_visit' | 'prayer_request' | 'other';
export type FollowUpPriority = 'low' | 'medium' | 'high';

export interface MemberFollowUp {
  id: string;
  ministry_id: string;
  member_id: string;
  follow_up_type: FollowUpType;
  description: string;
  priority: FollowUpPriority;
  follow_up_date: string;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// User Preferences Types
export interface NotificationPreferences {
  task_assigned: boolean;
  task_completed: boolean;
  report_due: boolean;
  report_submitted: boolean;
  event_reminder: boolean;
  birthday_reminder: boolean;
  member_followup: boolean;
  ministry_update: boolean;
}

export interface DisplayPreferences {
  theme: 'light' | 'dark';
  items_per_page: number;
  date_format: string;
}

export interface MinistryPreferences {
  id: string;
  ministry_id: string;
  leader_id: string;
  allow_member_followups: boolean;
  weekly_report_enabled: boolean;
  attendance_tracking_enabled: boolean;
  task_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}