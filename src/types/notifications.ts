export type NotificationWorkflowType =
  | 'birthday_greeting'
  | 'anniversary_greeting'
  | 'new_visitor_followup'
  | 'inactive_member_reengagement'
  | 'event_reminder'
  | 'ministry_leader_reminder'
  | 'first_attendance_celebration'
  | 'prayer_answered_followup'
  | 'announcement_expiry_admin';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface NotificationWorkflow {
  id: string;
  workflow_type: NotificationWorkflowType;
  name: string;
  description: string | null;
  is_active: boolean;
  schedule_config: ScheduleConfig;
  message_template: string;
  recipient_filter: RecipientFilter;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleConfig {
  time?: string; // "08:00"
  check_frequency?: 'daily' | 'weekly' | 'hourly';
  days_before?: number[];
  hours_before?: number[];
  days_threshold?: number;
  send_after_hours?: number;
  day1?: string;
  day3?: boolean;
  day7?: boolean;
  report_due_days?: number;
  task_due_days?: number;
  send?: string;
}

export interface RecipientFilter {
  ministry_id?: string;
  status?: string;
  district?: string;
  marital_status?: string;
}

export interface NotificationQueue {
  id: string;
  workflow_id: string | null;
  workflow_type: NotificationWorkflowType;
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_phone: string;
  message: string;
  status: NotificationStatus;
  scheduled_for: string;
  sent_at: string | null;
  error_message: string | null;
  sms_log_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  workflow_id: string | null;
  workflow_type: NotificationWorkflowType;
  recipient_count: number;
  successful_count: number;
  failed_count: number;
  triggered_by: string | null;
  triggered_at: string;
  completed_at: string | null;
  error_details: Record<string, any> | null;
  created_at: string;
}

export interface MemberNotificationPreferences {
  id: string;
  member_id: string;
  receive_birthday_sms: boolean;
  receive_anniversary_sms: boolean;
  receive_event_reminders: boolean;
  receive_general_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisitorFollowupStatus {
  id: string;
  visitor_id: string;
  day1_sent_at: string | null;
  day3_sent_at: string | null;
  day7_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationStats {
  total_sent: number;
  successful: number;
  failed: number;
  pending: number;
  success_rate: number;
}

export interface WorkflowStats extends NotificationStats {
  workflow_type: NotificationWorkflowType;
  workflow_name: string;
  last_run: string | null;
}
