-- =====================================================
-- Create Smart Notifications & Reminders System
-- =====================================================

-- Notification workflow types enum
CREATE TYPE notification_workflow_type AS ENUM (
  'birthday_greeting',
  'anniversary_greeting',
  'new_visitor_followup',
  'inactive_member_reengagement',
  'event_reminder',
  'ministry_leader_reminder',
  'first_attendance_celebration',
  'prayer_answered_followup',
  'announcement_expiry_admin'
);

-- Notification status enum
CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'cancelled'
);

-- =====================================================
-- Notification Workflows Table
-- =====================================================
CREATE TABLE notification_workflows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_type notification_workflow_type NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  schedule_config jsonb NOT NULL DEFAULT '{}',
  message_template text NOT NULL,
  recipient_filter jsonb DEFAULT '{}',
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_workflows IS 'Configuration for automated notification workflows';
COMMENT ON COLUMN notification_workflows.schedule_config IS 'JSON config for timing: {days_before: 7, time: "08:00", repeat: false}';
COMMENT ON COLUMN notification_workflows.message_template IS 'Message with placeholders like {first_name}, {event_title}';
COMMENT ON COLUMN notification_workflows.recipient_filter IS 'Filter criteria: {ministry_id: "...", status: "active"}';

-- =====================================================
-- Notification Queue Table
-- =====================================================
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id uuid REFERENCES notification_workflows(id) ON DELETE CASCADE,
  workflow_type notification_workflow_type NOT NULL,
  recipient_id uuid,
  recipient_name text,
  recipient_phone text NOT NULL,
  message text NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  sms_log_id uuid REFERENCES sms_logs(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_queue IS 'Queue of notifications to be sent';
COMMENT ON COLUMN notification_queue.metadata IS 'Additional context: {event_id, days_inactive, etc}';

-- Indexes for queue
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notification_queue_workflow ON notification_queue(workflow_type);
CREATE INDEX idx_notification_queue_recipient ON notification_queue(recipient_id);

-- =====================================================
-- Notification Logs Table
-- =====================================================
CREATE TABLE notification_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id uuid REFERENCES notification_workflows(id) ON DELETE SET NULL,
  workflow_type notification_workflow_type NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  successful_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  triggered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_logs IS 'History of notification workflow executions';

CREATE INDEX idx_notification_logs_workflow ON notification_logs(workflow_type);
CREATE INDEX idx_notification_logs_triggered ON notification_logs(triggered_at DESC);

-- =====================================================
-- Member Notification Preferences Table
-- =====================================================
CREATE TABLE member_notification_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  receive_birthday_sms boolean NOT NULL DEFAULT true,
  receive_anniversary_sms boolean NOT NULL DEFAULT true,
  receive_event_reminders boolean NOT NULL DEFAULT true,
  receive_general_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

COMMENT ON TABLE member_notification_preferences IS 'Member opt-in/opt-out preferences for notifications';

CREATE INDEX idx_member_notif_prefs_member ON member_notification_preferences(member_id);

-- =====================================================
-- Visitor Follow-up Tracking Table
-- =====================================================
CREATE TABLE visitor_followup_status (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  day1_sent_at timestamptz,
  day3_sent_at timestamptz,
  day7_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id)
);

COMMENT ON TABLE visitor_followup_status IS 'Tracks which follow-up messages have been sent to visitors';

CREATE INDEX idx_visitor_followup_visitor ON visitor_followup_status(visitor_id);

-- =====================================================
-- Insert Default Workflow Configurations
-- =====================================================
INSERT INTO notification_workflows (workflow_type, name, description, is_active, schedule_config, message_template) VALUES
(
  'birthday_greeting',
  'Birthday Greetings',
  'Send birthday wishes to members on their special day',
  true,
  '{"time": "08:00", "check_frequency": "daily"}',
  'Happy Birthday {first_name}! May God bless you abundantly on your special day. From your church family 🎉'
),
(
  'anniversary_greeting',
  'Anniversary Greetings',
  'Send anniversary wishes to married couples',
  true,
  '{"time": "08:00", "check_frequency": "daily"}',
  'Happy Anniversary {first_name}! Celebrating your marriage. God bless your union 💑'
),
(
  'new_visitor_followup',
  'New Visitor Follow-up',
  'Automated 3-step follow-up sequence for new visitors',
  true,
  '{"day1": "immediate", "day3": true, "day7": true}',
  'Welcome! We are blessed to have you. See you again soon!'
),
(
  'inactive_member_reengagement',
  'Inactive Member Re-engagement',
  'Reach out to members who haven''t attended in 30+ days',
  true,
  '{"check_frequency": "weekly", "days_threshold": 30}',
  'We miss you {first_name}! Your church family is thinking of you. Hope to see you soon. Need anything? We''re here 🙏'
),
(
  'event_reminder',
  'Event Reminders',
  'Send reminders before upcoming events',
  true,
  '{"days_before": [7, 1], "hours_before": [2]}',
  'Don''t forget! {event_title} on {event_date} at {event_time}. Location: {event_location}'
),
(
  'ministry_leader_reminder',
  'Ministry Leader Reminders',
  'Remind leaders about reports, budgets, and tasks',
  true,
  '{"report_due_days": 3, "task_due_days": 1}',
  'Reminder: {reminder_type} is due {due_info}. Please take action.'
),
(
  'first_attendance_celebration',
  'First Attendance Celebration',
  'Celebrate member''s first recorded attendance',
  true,
  '{"send_after_hours": 24}',
  'Congratulations {first_name} on your first service with us! Welcome to the church family! 🎊'
),
(
  'prayer_answered_followup',
  'Prayer Answered Follow-up',
  'Rejoice with members when prayers are answered',
  true,
  '{"send": "immediate"}',
  'Praise God! Your prayer has been answered! 🙌 We rejoice with you. Continue trusting in Him.'
),
(
  'announcement_expiry_admin',
  'Announcement Expiry Alert',
  'Notify admin when announcements are about to expire',
  true,
  '{"days_before": 1}',
  'Announcement "{announcement_title}" expires tomorrow. Renew or let it expire?'
);

-- =====================================================
-- RLS Policies for notification_workflows
-- =====================================================
ALTER TABLE notification_workflows ENABLE ROW LEVEL SECURITY;

-- Admin and secretary can view and manage workflows
CREATE POLICY notification_workflows_select ON notification_workflows
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'secretary')
      AND profiles.is_active = true
    )
  );

CREATE POLICY notification_workflows_update ON notification_workflows
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'secretary')
      AND profiles.is_active = true
    )
  );

-- =====================================================
-- RLS Policies for notification_queue
-- =====================================================
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Admin and secretary can view queue
CREATE POLICY notification_queue_select ON notification_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'secretary')
      AND profiles.is_active = true
    )
  );

-- =====================================================
-- RLS Policies for notification_logs
-- =====================================================
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Admin and secretary can view logs
CREATE POLICY notification_logs_select ON notification_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'secretary')
      AND profiles.is_active = true
    )
  );

-- =====================================================
-- RLS Policies for member_notification_preferences
-- =====================================================
ALTER TABLE member_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Members can view and update their own preferences
CREATE POLICY member_notif_prefs_select ON member_notification_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.id = member_notification_preferences.member_id
      AND members.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'secretary')
      AND profiles.is_active = true
    )
  );

CREATE POLICY member_notif_prefs_insert ON member_notification_preferences
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY member_notif_prefs_update ON member_notification_preferences
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.id = member_notification_preferences.member_id
      AND members.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'secretary')
      AND profiles.is_active = true
    )
  );

-- =====================================================
-- RLS Policies for visitor_followup_status
-- =====================================================
ALTER TABLE visitor_followup_status ENABLE ROW LEVEL SECURITY;

-- Admin and secretary can view and update
CREATE POLICY visitor_followup_select ON visitor_followup_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('administrator', 'secretary', 'ministry_leader')
      AND profiles.is_active = true
    )
  );

CREATE POLICY visitor_followup_insert ON visitor_followup_status
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY visitor_followup_update ON visitor_followup_status
  FOR UPDATE
  USING (true);

-- =====================================================
-- Function to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_workflows_updated_at
  BEFORE UPDATE ON notification_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_member_notif_prefs_updated_at
  BEFORE UPDATE ON member_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_visitor_followup_updated_at
  BEFORE UPDATE ON visitor_followup_status
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();
