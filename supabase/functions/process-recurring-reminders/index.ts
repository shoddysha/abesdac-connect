// Supabase Edge Function: process-recurring-reminders
// Runs every 15 minutes via pg_cron.
// Checks which active recurring reminders are due RIGHT NOW and sends SMS
// to all active members with phone numbers.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ARKESEL_API_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const ARKESEL_API_KEY  = Deno.env.get('ARKESEL_API_KEY')!;
const ARKESEL_SENDER_ID = Deno.env.get('ARKESEL_SENDER_ID') || 'AbekaSDAChu';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize phone number to Ghana format (233XXXXXXXXX).
 * Returns null for numbers that cannot be normalised.
 */
function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  let n = phone.replace(/[\s\-\(\)\+]/g, '');
  if (n.startsWith('0')) n = '233' + n.slice(1);
  if (!n.startsWith('233')) n = '233' + n;
  return n.length === 12 && /^233\d{9}$/.test(n) ? n : null;
}

/**
 * Given a service type, return its anchor day-of-week (0=Sun … 6=Sat).
 */
function anchorDow(serviceType: string): number {
  switch (serviceType) {
    case 'sabbath_service':    return 6; // Saturday
    case 'midweek_service':    return 3; // Wednesday
    case 'sunday_bible_study': return 0; // Sunday
    default:                   return 6;
  }
}

/**
 * Return true when the reminder should fire given the CURRENT UTC wall-clock
 * time and a ±15-minute window (so a cron that fires every 15 min never misses it).
 *
 * Logic:
 *   sendDay  = (anchorDow - send_day_offset + 7) % 7
 *   sendTime = reminder.send_time  (e.g. "18:00")
 *   Fire when  now.dayOfWeek === sendDay  AND  now.HH:MM === sendTime ± 15 min
 */
function isDue(serviceType: string, sendDayOffset: number, sendTime: string): boolean {
  const now = new Date();
  const nowDow  = now.getUTCDay();       // 0-6
  const nowHH   = now.getUTCHours();
  const nowMM   = now.getUTCMinutes();

  const targetDow = ((anchorDow(serviceType) - sendDayOffset) % 7 + 7) % 7;

  if (nowDow !== targetDow) return false;

  const [tHH, tMM] = sendTime.split(':').map(Number);
  const nowTotal    = nowHH * 60 + nowMM;
  const targetTotal = tHH  * 60 + tMM;

  // Within a 15-minute window
  return Math.abs(nowTotal - targetTotal) <= 15;
}

// ─── main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Array<{ service_type: string; status: string; recipients?: number; error?: string }> = [];

  try {
    // ── 1. Fetch all active reminders ──────────────────────────────────────
    const { data: reminders, error: remErr } = await supabase
      .from('recurring_service_reminders')
      .select('*')
      .eq('is_active', true);

    if (remErr) throw remErr;
    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active reminders', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Found ${reminders.length} active reminder(s)`);

    // ── 2. Filter to those due right now ───────────────────────────────────
    const dueReminders = reminders.filter((r: any) =>
      isDue(r.service_type, r.send_day_offset, r.send_time)
    );

    if (dueReminders.length === 0) {
      console.log('No reminders due at this time');
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders due now', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`${dueReminders.length} reminder(s) due now`);

    // ── 3. Fetch all active members with phone numbers ─────────────────────
    const { data: members, error: memErr } = await supabase
      .from('members')
      .select('id, first_name, last_name, phone')
      .eq('is_archived', false)
      .eq('status', 'active')
      .not('phone', 'is', null);

    if (memErr) throw memErr;

    const phoneNumbers = (members ?? [])
      .map((m: any) => normalizePhone(m.phone || ''))
      .filter((p): p is string => p !== null);

    if (phoneNumbers.length === 0) {
      console.log('No members with valid phone numbers');
      return new Response(
        JSON.stringify({ success: true, message: 'No valid phone numbers', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Sending to ${phoneNumbers.length} phone numbers`);

    // ── 4. For each due reminder, send the SMS ─────────────────────────────
    for (const reminder of dueReminders) {
      console.log(`Processing reminder: ${reminder.service_type} — "${reminder.message}"`);

      let smsLogId: string | null = null;

      try {
        // Insert SMS log
        const { data: logRow, error: logErr } = await supabase
          .from('sms_logs')
          .insert({
            type: 'manual',
            message: reminder.message,
            status: 'pending',
            recipient_count: phoneNumbers.length,
            successful_count: 0,
            failed_count: 0,
          })
          .select()
          .single();

        if (logErr) throw logErr;
        smsLogId = logRow.id;

        // Send via Arkesel
        if (!ARKESEL_API_KEY) throw new Error('ARKESEL_API_KEY secret not set');

        const arkeselRes = await fetch(ARKESEL_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': ARKESEL_API_KEY,
          },
          body: JSON.stringify({
            sender: ARKESEL_SENDER_ID,
            message: reminder.message,
            recipients: phoneNumbers,
          }),
        });

        const arkeselData = await arkeselRes.json();

        if (!arkeselRes.ok) {
          throw new Error(`Arkesel error ${arkeselRes.status}: ${JSON.stringify(arkeselData)}`);
        }

        // Update SMS log to sent
        await supabase
          .from('sms_logs')
          .update({
            status: 'sent',
            successful_count: phoneNumbers.length,
            failed_count: 0,
            arkesel_response: arkeselData,
            sent_at: new Date().toISOString(),
          })
          .eq('id', smsLogId);

        // Insert recipient records
        const recipientRows = (members ?? [])
          .map((m: any) => {
            const phone = normalizePhone(m.phone || '');
            if (!phone) return null;
            return {
              sms_log_id: smsLogId,
              member_id: m.id,
              phone_number: phone,
              status: 'sent',
              sent_at: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        if (recipientRows.length > 0) {
          await supabase.from('sms_recipients').insert(recipientRows);
        }

        results.push({
          service_type: reminder.service_type,
          status: 'sent',
          recipients: phoneNumbers.length,
        });

        console.log(`✅ Sent for ${reminder.service_type} to ${phoneNumbers.length} members`);

      } catch (sendErr: any) {
        console.error(`❌ Failed for ${reminder.service_type}:`, sendErr.message);

        // Update log to failed if we have a log id
        if (smsLogId) {
          await supabase
            .from('sms_logs')
            .update({
              status: 'failed',
              successful_count: 0,
              failed_count: phoneNumbers.length,
              error_message: sendErr.message,
            })
            .eq('id', smsLogId);
        }

        results.push({
          service_type: reminder.service_type,
          status: 'failed',
          error: sendErr.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: dueReminders.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    console.error('Fatal error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
