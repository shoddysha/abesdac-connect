import { supabase } from '@/lib/supabase';
import type {
  NotificationWorkflow,
  NotificationQueue,
  NotificationLog,
  NotificationWorkflowType,
  NotificationStatus,
  NotificationStats,
  WorkflowStats,
  MemberNotificationPreferences,
  VisitorFollowupStatus,
} from '@/types/notifications';
import type { SmsType } from '@/types/database';
import { sendBulkSms, normalizePhoneNumber, sendToArkesel, createSmsLog, updateSmsLog } from './sms';
import { format, addDays, parseISO, differenceInDays, isSameDay } from 'date-fns';

/**
 * Fetch all notification workflows
 */
export async function fetchNotificationWorkflows(): Promise<NotificationWorkflow[]> {
  const { data, error } = await supabase
    .from('notification_workflows')
    .select('*')
    .order('workflow_type', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Update notification workflow
 */
export async function updateNotificationWorkflow(
  id: string,
  updates: Partial<NotificationWorkflow>
): Promise<void> {
  const { error } = await supabase
    .from('notification_workflows')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

/**
 * Fetch notification queue
 */
export async function fetchNotificationQueue(
  status?: NotificationStatus,
  limit = 100
): Promise<NotificationQueue[]> {
  let query = supabase
    .from('notification_queue')
    .select('*')
    .order('scheduled_for', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Fetch notification logs
 */
export async function fetchNotificationLogs(limit = 50): Promise<NotificationLog[]> {
  const { data, error } = await supabase
    .from('notification_logs')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(): Promise<NotificationStats> {
  const { data, error } = await supabase
    .from('notification_queue')
    .select('status');

  if (error) throw error;

  const stats = (data || []).reduce(
    (acc, item) => {
      if (item.status === 'sent') acc.successful++;
      else if (item.status === 'failed') acc.failed++;
      else if (item.status === 'pending') acc.pending++;
      acc.total_sent++;
      return acc;
    },
    { total_sent: 0, successful: 0, failed: 0, pending: 0, success_rate: 0 }
  );

  stats.success_rate = stats.total_sent > 0
    ? (stats.successful / stats.total_sent) * 100
    : 0;

  return stats;
}

/**
 * Get workflow-specific statistics
 */
export async function getWorkflowStats(): Promise<WorkflowStats[]> {
  const [workflows, queue] = await Promise.all([
    fetchNotificationWorkflows(),
    supabase.from('notification_queue').select('workflow_type, status'),
  ]);

  if (queue.error) throw queue.error;

  return workflows.map((workflow) => {
    const workflowQueue = (queue.data || []).filter(
      (q: any) => q.workflow_type === workflow.workflow_type
    );

    const stats = workflowQueue.reduce(
      (acc, item: any) => {
        if (item.status === 'sent') acc.successful++;
        else if (item.status === 'failed') acc.failed++;
        else if (item.status === 'pending') acc.pending++;
        acc.total_sent++;
        return acc;
      },
      { total_sent: 0, successful: 0, failed: 0, pending: 0, success_rate: 0 }
    );

    stats.success_rate = stats.total_sent > 0
      ? (stats.successful / stats.total_sent) * 100
      : 0;

    return {
      ...stats,
      workflow_type: workflow.workflow_type,
      workflow_name: workflow.name,
      last_run: workflow.last_run_at,
    };
  });
}

/**
 * Queue a notification
 */
export async function queueNotification(
  workflowType: NotificationWorkflowType,
  recipientId: string | null,
  recipientName: string | null,
  recipientPhone: string,
  message: string,
  scheduledFor: Date = new Date(),
  metadata: Record<string, any> = {}
): Promise<void> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('id')
    .eq('workflow_type', workflowType)
    .single();

  const { error } = await supabase.from('notification_queue').insert({
    workflow_id: workflow.data?.id || null,
    workflow_type: workflowType,
    recipient_id: recipientId,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    message,
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending',
    metadata,
  });

  if (error) throw error;
}

/**
 * Process pending notifications (send them via SMS)
 */
export async function processPendingNotifications(): Promise<{
  sent: number;
  failed: number;
}> {
  const { data: pending, error } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(100);

  if (error) throw error;
  if (!pending || pending.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  // Process each notification individually to avoid enum conflicts and support visitors
  for (const notif of pending) {
    try {
      // Get phone numbers for this notification
      const phoneNumbers = notif.recipient_phone ? [normalizePhoneNumber(notif.recipient_phone)] : [];
      
      if (phoneNumbers.length === 0 || !phoneNumbers[0]) {
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            error_message: 'No valid phone number',
          })
          .eq('id', notif.id);
        failed++;
        continue;
      }

      // Map workflow type to valid sms_type enum
      const smsTypeMap: Record<string, SmsType> = {
        'visitor_welcome': 'manual',
        'new_member_welcome_day1': 'manual',
        'new_member_welcome_day3': 'manual',
        'new_member_welcome_week2': 'manual',
        'birthday_greeting': 'manual',
        'anniversary_greeting': 'manual',
        'baptism_anniversary': 'manual',
        'joining_anniversary': 'manual',
        'new_visitor_followup': 'manual',
        'inactive_member_reengagement': 'manual',
        'event_reminder': 'event_reminder',
        'ministry_report_reminder': 'manual',
        'budget_approved': 'manual',
        'budget_rejected': 'manual',
        'followup_due_reminder': 'manual',
        'event_cancelled': 'event_notification',
        'prayer_answered_update': 'manual',
        'announcement_published': 'announcement',
      };

      const smsType = smsTypeMap[notif.workflow_type] || 'manual';

      // Create SMS log directly (without using sendBulkSms to avoid recipient filtering)
      const smsLog = await createSmsLog(smsType, notif.message, 1);

      try {
        // Send via Arkesel
        const arkeselResponse = await sendToArkesel(phoneNumbers as string[], notif.message);

        // Update log with success
        await updateSmsLog(smsLog.id, 'sent', 1, 0, arkeselResponse);

        // Update notification queue
        await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sms_log_id: smsLog.id,
          })
          .eq('id', notif.id);

        sent++;
      } catch (apiError) {
        // Update log with failure
        await updateSmsLog(
          smsLog.id,
          'failed',
          0,
          1,
          undefined,
          (apiError as Error).message
        );

        // Update notification queue
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            error_message: (apiError as Error).message,
          })
          .eq('id', notif.id);

        failed++;
      }
    } catch (err) {
      console.error(`Failed to send notification ${notif.id}:`, err);
      
      // Mark as failed
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          error_message: (err as Error).message,
        })
        .eq('id', notif.id);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Replace placeholders in message template
 */
export function replacePlaceholders(
  template: string,
  data: Record<string, any>
): string {
  let message = template;
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder, 'g'), String(value || ''));
  });
  return message;
}

/**
 * Check for birthdays and queue notifications
 */
export async function checkBirthdays(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'birthday_greeting')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  // Get members with birthdays today
  const { data: members, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone, date_of_birth, status')
    .eq('status', 'active')
    .not('phone', 'is', null)
    .not('date_of_birth', 'is', null);

  if (error) throw error;

  let queued = 0;

  for (const member of members || []) {
    if (!member.date_of_birth) continue;

    const dob = parseISO(member.date_of_birth);
    const dobMonth = dob.getMonth() + 1;
    const dobDay = dob.getDate();

    if (dobMonth === todayMonth && dobDay === todayDay) {
      // Check if already sent today
      const { data: existing } = await supabase
        .from('notification_queue')
        .select('id')
        .eq('workflow_type', 'birthday_greeting')
        .eq('recipient_id', member.id)
        .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString())
        .single();

      if (existing) continue;

      const message = replacePlaceholders(workflow.data.message_template, {
        first_name: member.first_name,
        last_name: member.last_name,
        full_name: `${member.first_name} ${member.last_name}`,
      });

      await queueNotification(
        'birthday_greeting',
        member.id,
        `${member.first_name} ${member.last_name}`,
        member.phone,
        message,
        new Date(),
        { date_of_birth: member.date_of_birth }
      );

      queued++;
    }
  }

  // Update last_run_at
  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return queued;
}

/**
 * Check for anniversaries and queue notifications
 */
export async function checkAnniversaries(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'anniversary_greeting')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  // Note: We need a wedding_date field. For now, we'll skip this
  // and return 0. You can add a migration to add wedding_date to members table
  
  // Update last_run_at
  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return 0;
}

/**
 * Check for new visitors and queue follow-up sequence
 */
export async function checkNewVisitors(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'new_visitor_followup')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  const now = new Date();

  // Get visitors from the last 7 days
  const sevenDaysAgo = addDays(now, -7);
  const { data: visitors, error } = await supabase
    .from('visitors')
    .select('*')
    .gte('visit_date', sevenDaysAgo.toISOString().split('T')[0])
    .not('phone_number', 'is', null);

  if (error) throw error;

  let queued = 0;

  for (const visitor of visitors || []) {
    if (!visitor.phone_number) continue;

    const visitDate = parseISO(visitor.visit_date);
    const daysSinceVisit = differenceInDays(now, visitDate);

    // Get or create follow-up status
    let { data: status } = await supabase
      .from('visitor_followup_status')
      .select('*')
      .eq('visitor_id', visitor.id)
      .single();

    if (!status) {
      const { data: newStatus } = await supabase
        .from('visitor_followup_status')
        .insert({ visitor_id: visitor.id })
        .select()
        .single();
      status = newStatus;
    }

    if (!status) continue;

    const messages = [
      {
        day: 0,
        field: 'day1_sent_at' as const,
        template: 'Welcome! We are blessed to have you. See you again soon!',
      },
      {
        day: 3,
        field: 'day3_sent_at' as const,
        template: `Hi ${visitor.first_name}, we hope to see you this Sabbath. God bless you!`,
      },
      {
        day: 7,
        field: 'day7_sent_at' as const,
        template: `Still thinking of you! Need prayer or have questions? We're here for you.`,
      },
    ];

    for (const msg of messages) {
      if (daysSinceVisit >= msg.day && !status[msg.field]) {
        await queueNotification(
          'new_visitor_followup',
          visitor.id,
          `${visitor.first_name} ${visitor.last_name}`,
          visitor.phone_number,
          msg.template,
          new Date()
        );

        // Mark as sent
        await supabase
          .from('visitor_followup_status')
          .update({ [msg.field]: new Date().toISOString() })
          .eq('visitor_id', visitor.id);

        queued++;
      }
    }
  }

  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return queued;
}

/**
 * Check for inactive members and queue re-engagement
 */
export async function checkInactiveMembers(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'inactive_member_reengagement')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  const daysThreshold = (workflow.data.schedule_config as any)?.days_threshold || 30;
  const thresholdDate = addDays(new Date(), -daysThreshold);

  // Get active members
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone, status')
    .eq('status', 'active')
    .not('phone', 'is', null);

  if (membersError) throw membersError;

  let queued = 0;

  for (const member of members || []) {
    // Check last attendance
    const { data: lastAttendance } = await supabase
      .from('attendance')
      .select('service_date')
      .eq('member_id', member.id)
      .order('service_date', { ascending: false })
      .limit(1)
      .single();

    if (!lastAttendance) continue;

    const lastDate = parseISO(lastAttendance.service_date);
    const daysInactive = differenceInDays(new Date(), lastDate);

    if (daysInactive >= daysThreshold) {
      // Check if already sent this month
      const { data: existing } = await supabase
        .from('notification_queue')
        .select('id')
        .eq('workflow_type', 'inactive_member_reengagement')
        .eq('recipient_id', member.id)
        .gte('created_at', addDays(new Date(), -30).toISOString())
        .single();

      if (existing) continue;

      const message = replacePlaceholders(workflow.data.message_template, {
        first_name: member.first_name,
        last_name: member.last_name,
      });

      await queueNotification(
        'inactive_member_reengagement',
        member.id,
        `${member.first_name} ${member.last_name}`,
        member.phone,
        message,
        new Date(),
        { days_inactive: daysInactive }
      );

      queued++;
    }
  }

  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return queued;
}

/**
 * Check for upcoming events and queue reminders
 */
export async function checkEventReminders(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'event_reminder')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  const daysBefore = (workflow.data.schedule_config as any)?.days_before || [7, 1];
  const now = new Date();

  // Get upcoming events
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'upcoming')
    .gte('start_time', now.toISOString());

  if (error) throw error;

  let queued = 0;

  for (const event of events || []) {
    const eventDate = parseISO(event.start_time);
    const daysUntil = differenceInDays(eventDate, now);

    for (const dayBefore of daysBefore) {
      if (daysUntil === dayBefore) {
        // Check if already sent for this day
        const { data: existing } = await supabase
          .from('notification_queue')
          .select('id')
          .eq('workflow_type', 'event_reminder')
          .eq('metadata->>event_id', event.id)
          .eq('metadata->>days_before', String(dayBefore))
          .single();

        if (existing) continue;

        // Get all active members with phones
        const { data: members } = await supabase
          .from('members')
          .select('id, first_name, last_name, phone')
          .eq('status', 'active')
          .not('phone', 'is', null);

        if (!members) continue;

        for (const member of members) {
          const message = replacePlaceholders(workflow.data.message_template, {
            first_name: member.first_name,
            event_title: event.title,
            event_date: format(eventDate, 'MMM d, yyyy'),
            event_time: format(eventDate, 'h:mm a'),
            event_location: event.location || 'Church',
          });

          await queueNotification(
            'event_reminder',
            member.id,
            `${member.first_name} ${member.last_name}`,
            member.phone,
            message,
            new Date(),
            { event_id: event.id, days_before: dayBefore }
          );

          queued++;
        }
      }
    }
  }

  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return queued;
}

/**
 * Master function to check all workflows
 */
export async function checkAllWorkflows(): Promise<{
  birthdays: number;
  anniversaries: number;
  visitors: number;
  inactive: number;
  events: number;
  baptismAnniversaries: number;
  joiningAnniversaries: number;
  followUpReminders: number;
}> {
  const [
    birthdays,
    anniversaries,
    visitors,
    inactive,
    events,
    baptismAnniversaries,
    joiningAnniversaries,
    followUpReminders,
  ] = await Promise.all([
    checkBirthdays(),
    checkAnniversaries(),
    checkNewVisitors(),
    checkInactiveMembers(),
    checkEventReminders(),
    checkBaptismAnniversaries(),
    checkJoiningAnniversaries(),
    checkFollowUpReminders(),
  ]);

  return {
    birthdays,
    anniversaries,
    visitors,
    inactive,
    events,
    baptismAnniversaries,
    joiningAnniversaries,
    followUpReminders,
  };
}

/**
 * Queue visitor welcome SMS (triggered when visitor is created)
 */
export async function queueVisitorWelcomeSms(
  visitorId: string,
  firstName: string,
  lastName: string,
  phone: string,
  visitDate: string
): Promise<void> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'visitor_welcome')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return;

  const message = replacePlaceholders(workflow.data.message_template, {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`,
    visit_date: format(parseISO(visitDate), 'MMM d, yyyy'),
  });

  await queueNotification(
    'visitor_welcome',
    visitorId,
    `${firstName} ${lastName}`,
    phone,
    message,
    new Date(),
    { visit_date: visitDate }
  );
}

/**
 * Queue new member welcome series (Day 1, Day 3, Week 2)
 */
export async function queueNewMemberWelcomeSeries(
  memberId: string,
  firstName: string,
  lastName: string,
  phone: string,
  dateJoined: string
): Promise<void> {
  const workflows = await supabase
    .from('notification_workflows')
    .select('*')
    .in('workflow_type', ['new_member_welcome_day1', 'new_member_welcome_day3', 'new_member_welcome_week2'])
    .eq('is_active', true);

  if (workflows.error || !workflows.data) return;

  const joinDate = parseISO(dateJoined);

  for (const workflow of workflows.data) {
    const scheduleConfig = workflow.schedule_config as any;
    let scheduledFor = new Date();

    if (scheduleConfig.delay_days) {
      scheduledFor = addDays(joinDate, scheduleConfig.delay_days);
    }

    const message = replacePlaceholders(workflow.message_template, {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
    });

    await queueNotification(
      workflow.workflow_type as any,
      memberId,
      `${firstName} ${lastName}`,
      phone,
      message,
      scheduledFor,
      { date_joined: dateJoined }
    );
  }
}

/**
 * Check baptism anniversaries and queue notifications
 */
export async function checkBaptismAnniversaries(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'baptism_anniversary')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const { data: members, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone, baptism_date, status')
    .eq('status', 'active')
    .not('phone', 'is', null)
    .not('baptism_date', 'is', null);

  if (error) throw error;

  let queued = 0;

  for (const member of members || []) {
    if (!member.baptism_date) continue;

    const baptismDate = parseISO(member.baptism_date);
    const baptismMonth = baptismDate.getMonth() + 1;
    const baptismDay = baptismDate.getDate();

    if (baptismMonth === todayMonth && baptismDay === todayDay) {
      // Check if already sent today
      const { data: existing } = await supabase
        .from('notification_queue')
        .select('id')
        .eq('workflow_type', 'baptism_anniversary')
        .eq('recipient_id', member.id)
        .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString())
        .single();

      if (existing) continue;

      const message = replacePlaceholders(workflow.data.message_template, {
        first_name: member.first_name,
        last_name: member.last_name,
      });

      await queueNotification(
        'baptism_anniversary',
        member.id,
        `${member.first_name} ${member.last_name}`,
        member.phone,
        message
      );

      queued++;
    }
  }

  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return queued;
}

/**
 * Check joining anniversaries and queue notifications
 */
export async function checkJoiningAnniversaries(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'joining_anniversary')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const { data: members, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone, date_joined, status')
    .eq('status', 'active')
    .not('phone', 'is', null);

  if (error) throw error;

  let queued = 0;

  for (const member of members || []) {
    const joinedDate = parseISO(member.date_joined);
    const joinedMonth = joinedDate.getMonth() + 1;
    const joinedDay = joinedDate.getDate();

    if (joinedMonth === todayMonth && joinedDay === todayDay) {
      const yearsJoined = today.getFullYear() - joinedDate.getFullYear();
      if (yearsJoined === 0) continue; // Skip if joined this year

      // Check if already sent today
      const { data: existing } = await supabase
        .from('notification_queue')
        .select('id')
        .eq('workflow_type', 'joining_anniversary')
        .eq('recipient_id', member.id)
        .gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString())
        .single();

      if (existing) continue;

      const message = replacePlaceholders(workflow.data.message_template, {
        first_name: member.first_name,
        last_name: member.last_name,
        years: yearsJoined.toString(),
      });

      await queueNotification(
        'joining_anniversary',
        member.id,
        `${member.first_name} ${member.last_name}`,
        member.phone,
        message
      );

      queued++;
    }
  }

  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return queued;
}

/**
 * Queue budget approval notification
 */
export async function queueBudgetApprovalNotification(
  budgetId: string,
  leaderId: string,
  leaderName: string,
  leaderPhone: string,
  budgetTitle: string,
  status: 'approved' | 'rejected',
  reviewNote: string
): Promise<void> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'budget_approved')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return;

  const message = replacePlaceholders(workflow.data.message_template, {
    budget_title: budgetTitle,
    status: status === 'approved' ? 'APPROVED' : 'REJECTED',
    review_note: reviewNote || 'No additional notes.',
  });

  await queueNotification(
    'budget_approved',
    leaderId,
    leaderName,
    leaderPhone,
    message,
    new Date(),
    { budget_id: budgetId, status, review_note: reviewNote }
  );
}

/**
 * Check follow-up due reminders (day before)
 */
export async function checkFollowUpReminders(): Promise<number> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'followup_due_reminder')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return 0;

  const tomorrow = addDays(new Date(), 1);
  const tomorrowDate = format(tomorrow, 'yyyy-MM-dd');

  // Get follow-ups due tomorrow
  const { data: followUps, error } = await supabase
    .from('member_followups')
    .select(`
      *,
      members:member_id(first_name, last_name),
      profiles:created_by(full_name, phone)
    `)
    .eq('follow_up_date', tomorrowDate)
    .is('completed_at', null);

  if (error) throw error;

  let queued = 0;

  for (const followUp of followUps || []) {
    if (!followUp.profiles?.phone) continue;

    const message = replacePlaceholders(workflow.data.message_template, {
      member_name: followUp.members
        ? `${followUp.members.first_name} ${followUp.members.last_name}`
        : 'Unknown',
      followup_type: followUp.follow_up_type.replace(/_/g, ' '),
    });

    await queueNotification(
      'followup_due_reminder',
      followUp.created_by,
      followUp.profiles.full_name,
      followUp.profiles.phone,
      message,
      new Date(),
      { followup_id: followUp.id, member_id: followUp.member_id }
    );

    queued++;
  }

  await supabase
    .from('notification_workflows')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', workflow.data.id);

  return queued;
}

/**
 * Queue event cancellation alert
 */
export async function queueEventCancellationAlert(
  eventId: string,
  eventTitle: string,
  eventDate: string
): Promise<void> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'event_cancelled')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return;

  // Get all active members with phones
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone')
    .eq('status', 'active')
    .not('phone', 'is', null);

  if (!members) return;

  for (const member of members) {
    const message = replacePlaceholders(workflow.data.message_template, {
      event_title: eventTitle,
      event_date: format(parseISO(eventDate), 'MMM d, yyyy'),
    });

    await queueNotification(
      'event_cancelled',
      member.id,
      `${member.first_name} ${member.last_name}`,
      member.phone,
      message,
      new Date(),
      { event_id: eventId }
    );
  }
}

/**
 * Queue prayer request answered notification
 */
export async function queuePrayerAnsweredNotification(
  prayerRequestId: string,
  requesterId: string,
  requesterName: string,
  requesterPhone: string
): Promise<void> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'prayer_answered_update')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return;

  const message = replacePlaceholders(workflow.data.message_template, {
    requester_name: requesterName,
  });

  await queueNotification(
    'prayer_answered_update',
    requesterId,
    requesterName,
    requesterPhone,
    message,
    new Date(),
    { prayer_request_id: prayerRequestId }
  );
}

/**
 * Queue announcement broadcast
 */
export async function queueAnnouncementBroadcast(
  announcementId: string,
  announcementTitle: string,
  announcementBody: string
): Promise<void> {
  const workflow = await supabase
    .from('notification_workflows')
    .select('*')
    .eq('workflow_type', 'announcement_published')
    .eq('is_active', true)
    .single();

  if (workflow.error || !workflow.data) return;

  // Get all active members with phones
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone')
    .eq('status', 'active')
    .not('phone', 'is', null);

  if (!members) return;

  for (const member of members) {
    const message = replacePlaceholders(workflow.data.message_template, {
      announcement_title: announcementTitle,
      announcement_body: announcementBody.substring(0, 100), // Limit length
    });

    await queueNotification(
      'announcement_published',
      member.id,
      `${member.first_name} ${member.last_name}`,
      member.phone,
      message,
      new Date(),
      { announcement_id: announcementId }
    );
  }
}
