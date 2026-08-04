import { supabase } from '@/lib/supabase';
import type {
  SmsLog,
  SmsRecipient,
  ScheduledSms,
  RecipientFilters,
  ArkeselSmsResponse,
  SmsType,
  Member,
} from '@/types/database';

// Arkesel API configuration
const ARKESEL_API_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const ARKESEL_API_KEY = import.meta.env.VITE_ARKESEL_API_KEY as string;
const ARKESEL_SENDER_ID = import.meta.env.VITE_ARKESEL_SENDER_ID || 'AbekaSDAChu';

/**
 * Normalize phone number to Ghana format (233XXXXXXXXX)
 * Handles formats like: 0534268869, +233534268869, 233534268869
 */
function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Remove all spaces, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 0, replace with 233
  if (cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  }

  // If doesn't start with 233, add it
  if (!cleaned.startsWith('233')) {
    cleaned = '233' + cleaned;
  }

  // Validate length (should be 12 digits for Ghana: 233 + 9 digits)
  if (cleaned.length !== 12 || !cleaned.match(/^233\d{9}$/)) {
    return null;
  }

  return cleaned;
}

/**
 * Send SMS via Arkesel API
 */
async function sendToArkesel(recipients: string[], message: string): Promise<ArkeselSmsResponse> {
  if (!ARKESEL_API_KEY) {
    throw new Error('Arkesel API key is not configured');
  }

  const response = await fetch(ARKESEL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': ARKESEL_API_KEY,
    },
    body: JSON.stringify({
      sender: ARKESEL_SENDER_ID,
      message: message,
      recipients: recipients,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Arkesel API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data as ArkeselSmsResponse;
}

/**
 * Fetch members based on filters
 */
export async function fetchRecipientsForFilters(filters: RecipientFilters): Promise<Member[]> {
  let query = supabase
    .from('members')
    .select('*')
    .eq('is_archived', false)
    .eq('status', 'active')
    .not('phone', 'is', null);

  if (filters.all_members) {
    // Fetch all active members with phone numbers
  } else if (filters.ministry_id) {
    query = query.eq('ministry_id', filters.ministry_id);
  } else if (filters.member_ids && filters.member_ids.length > 0) {
    query = query.in('id', filters.member_ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Member[]) || [];
}

/**
 * Create SMS log entry
 */
async function createSmsLog(
  type: SmsType,
  message: string,
  recipientCount: number,
  eventId?: string,
  announcementId?: string
): Promise<SmsLog> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sms_logs')
    .insert({
      type,
      message,
      recipient_count: recipientCount,
      event_id: eventId || null,
      announcement_id: announcementId || null,
      sent_by: user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SmsLog;
}

/**
 * Update SMS log with results
 */
async function updateSmsLog(
  logId: string,
  status: 'sent' | 'failed',
  successCount: number,
  failedCount: number,
  arkeselResponse?: ArkeselSmsResponse,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('sms_logs')
    .update({
      status,
      successful_count: successCount,
      failed_count: failedCount,
      arkesel_response: arkeselResponse || null,
      error_message: errorMessage || null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', logId);

  if (error) throw error;
}

/**
 * Create SMS recipient records
 */
async function createSmsRecipients(
  logId: string,
  members: Member[],
  status: 'sent' | 'failed' = 'sent'
): Promise<void> {
  const recipients = members
    .map((member) => {
      const normalizedPhone = normalizePhoneNumber(member.phone || '');
      if (!normalizedPhone) return null;

      return {
        sms_log_id: logId,
        member_id: member.id,
        phone_number: normalizedPhone,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (recipients.length === 0) return;

  const { error } = await supabase.from('sms_recipients').insert(recipients);
  if (error) throw error;
}

/**
 * Send bulk SMS to members
 */
export async function sendBulkSms(
  message: string,
  filters: RecipientFilters,
  type: SmsType,
  eventId?: string,
  announcementId?: string
): Promise<{ success: boolean; logId: string; message: string }> {
  try {
    // Fetch recipients
    const members = await fetchRecipientsForFilters(filters);

    if (members.length === 0) {
      throw new Error('No recipients found with valid phone numbers');
    }

    // Normalize and validate phone numbers
    const validMembers = members.filter((m) => normalizePhoneNumber(m.phone || '') !== null);

    if (validMembers.length === 0) {
      throw new Error('No valid phone numbers found');
    }

    const phoneNumbers = validMembers
      .map((m) => normalizePhoneNumber(m.phone || ''))
      .filter((p): p is string => p !== null);

    // Create SMS log
    const smsLog = await createSmsLog(type, message, phoneNumbers.length, eventId, announcementId);

    try {
      // Send via Arkesel
      const arkeselResponse = await sendToArkesel(phoneNumbers, message);

      // Update log with success
      await updateSmsLog(smsLog.id, 'sent', phoneNumbers.length, 0, arkeselResponse);

      // Create recipient records
      await createSmsRecipients(smsLog.id, validMembers, 'sent');

      return {
        success: true,
        logId: smsLog.id,
        message: `SMS sent successfully to ${phoneNumbers.length} recipient(s)`,
      };
    } catch (apiError) {
      // Update log with failure
      await updateSmsLog(
        smsLog.id,
        'failed',
        0,
        phoneNumbers.length,
        undefined,
        (apiError as Error).message
      );

      // Create recipient records with failed status
      await createSmsRecipients(smsLog.id, validMembers, 'failed');

      throw apiError;
    }
  } catch (error) {
    return {
      success: false,
      logId: '',
      message: (error as Error).message,
    };
  }
}

/**
 * Schedule SMS for future sending (e.g., 24 hours before event)
 */
export async function scheduleEventReminder(
  eventId: string,
  message: string,
  scheduledFor: Date,
  filters: RecipientFilters
): Promise<ScheduledSms> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('scheduled_sms')
    .insert({
      event_id: eventId,
      message,
      scheduled_for: scheduledFor.toISOString(),
      recipient_filters: filters,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledSms;
}

/**
 * Fetch all scheduled SMS
 */
export async function fetchScheduledSms(): Promise<ScheduledSms[]> {
  const { data, error } = await supabase
    .from('scheduled_sms')
    .select('*, events(title, start_time)')
    .order('scheduled_for', { ascending: true });

  if (error) throw error;
  return data as ScheduledSms[];
}

/**
 * Cancel scheduled SMS
 */
export async function cancelScheduledSms(id: string): Promise<void> {
  const { error } = await supabase.from('scheduled_sms').update({ status: 'cancelled' }).eq('id', id);

  if (error) throw error;
}

/**
 * Delete scheduled SMS
 */
export async function deleteScheduledSms(id: string): Promise<void> {
  const { error } = await supabase.from('scheduled_sms').delete().eq('id', id);

  if (error) throw error;
}

/**
 * Update scheduled SMS
 */
export async function updateScheduledSms(
  id: string,
  payload: Partial<ScheduledSms>
): Promise<ScheduledSms> {
  const { data, error } = await supabase
    .from('scheduled_sms')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledSms;
}

/**
 * Fetch SMS logs with optional filters
 */
export async function fetchSmsLogs(eventId?: string, announcementId?: string): Promise<SmsLog[]> {
  let query = supabase.from('sms_logs').select('*, profiles(full_name)').order('created_at', { ascending: false });

  if (eventId) {
    query = query.eq('event_id', eventId);
  }
  if (announcementId) {
    query = query.eq('announcement_id', announcementId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as SmsLog[];
}

/**
 * Fetch SMS recipients for a specific log
 */
export async function fetchSmsRecipients(logId: string): Promise<SmsRecipient[]> {
  const { data, error } = await supabase
    .from('sms_recipients')
    .select('*, members(first_name, last_name, member_code)')
    .eq('sms_log_id', logId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as SmsRecipient[];
}

/**
 * Get SMS statistics
 */
export async function fetchSmsStats(): Promise<{
  total: number;
  sent: number;
  failed: number;
  pending: number;
}> {
  const { count: total } = await supabase.from('sms_logs').select('*', { count: 'exact', head: true });

  const { count: sent } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent');

  const { count: failed } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  const { count: pending } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return {
    total: total || 0,
    sent: sent || 0,
    failed: failed || 0,
    pending: pending || 0,
  };
}

/**
 * Process pending scheduled SMS (to be called by a cron job or background task)
 * This function should be called periodically to check for and send scheduled SMS
 */
export async function processPendingScheduledSms(): Promise<void> {
  const { data: pendingSms, error } = await supabase
    .from('scheduled_sms')
    .select('*, events(title)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString());

  if (error) throw error;
  if (!pendingSms || pendingSms.length === 0) return;

  for (const scheduled of pendingSms) {
    try {
      // Send the SMS
      const result = await sendBulkSms(
        scheduled.message,
        scheduled.recipient_filters || { all_members: true },
        'event_reminder',
        scheduled.event_id
      );

      // Update scheduled SMS record
      await supabase
        .from('scheduled_sms')
        .update({
          status: result.success ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
          sms_log_id: result.logId || null,
        })
        .eq('id', scheduled.id);
    } catch (error) {
      console.error(`Failed to process scheduled SMS ${scheduled.id}:`, error);
      // Mark as failed
      await supabase
        .from('scheduled_sms')
        .update({
          status: 'failed',
        })
        .eq('id', scheduled.id);
    }
  }
}
