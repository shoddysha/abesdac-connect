/**
 * Google Apps Script for Instant Prayer Request Syncing
 * 
 * HOW TO USE:
 * 1. Open your Google Sheet (the one linked to your prayer request form)
 * 2. Go to Extensions → Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire file
 * 5. Replace YOUR_PROJECT_REF with your actual Supabase project reference
 * 6. Replace YOUR_SUPABASE_ANON_KEY with your Supabase anon key
 * 7. Click Save (disk icon)
 * 8. Click "Run" → Select "onFormSubmit" → Authorize the script
 * 9. Click Triggers (clock icon in left sidebar)
 * 10. Click "+ Add Trigger" button
 * 11. Configure:
 *     - Choose function: onFormSubmit
 *     - Choose event source: From spreadsheet
 *     - Choose event type: On form submit
 * 12. Click Save
 * 
 * NOW: Every time someone submits the form, it will automatically sync to your CMS!
 */

// ============================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================

const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ============================================================
// MAIN FUNCTION - Runs when form is submitted
// ============================================================

function onFormSubmit(e) {
  try {
    Logger.log('Form submitted - triggering sync...');
    
    // Call your Supabase Edge Function to sync
    const url = `${SUPABASE_URL}/functions/v1/sync-prayer-requests`;
    
    const options = {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    Logger.log(`Response code: ${responseCode}`);
    Logger.log(`Response body: ${responseBody}`);
    
    if (responseCode === 200) {
      Logger.log('✅ Successfully triggered prayer request sync');
    } else {
      Logger.log('⚠️ Sync triggered but received non-200 response');
    }
    
  } catch (error) {
    Logger.log('❌ Error triggering sync: ' + error.toString());
    // Don't throw - we don't want form submission to fail
  }
}

// ============================================================
// TEST FUNCTION - Run this manually to test the sync
// ============================================================

function testSync() {
  Logger.log('Running manual test sync...');
  
  const url = `${SUPABASE_URL}/functions/v1/sync-prayer-requests`;
  
  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    Logger.log(`Response code: ${responseCode}`);
    Logger.log(`Response body: ${responseBody}`);
    
    if (responseCode === 200) {
      const data = JSON.parse(responseBody);
      Logger.log(`✅ Sync successful! Imported ${data.newCount} new prayer request(s)`);
    } else {
      Logger.log(`⚠️ Sync failed with code ${responseCode}`);
    }
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
  }
}

// ============================================================
// FIND YOUR SUPABASE CREDENTIALS
// ============================================================

/**
 * TO FIND YOUR PROJECT REF:
 * 1. Go to https://app.supabase.com
 * 2. Click on your project
 * 3. Go to Settings → API
 * 4. Look for "Project URL": https://xxxxx.supabase.co
 * 5. The "xxxxx" part is your project ref
 * 
 * TO FIND YOUR ANON KEY:
 * 1. Same place: Settings → API
 * 2. Look for "Project API keys"
 * 3. Copy the "anon" "public" key (NOT the service_role key!)
 * 4. It starts with "eyJ..."
 */

// ============================================================
// TROUBLESHOOTING
// ============================================================

/**
 * TO VIEW LOGS:
 * 1. In Apps Script editor, click "Executions" (list icon in left sidebar)
 * 2. Click on any execution to see the log output
 * 
 * COMMON ISSUES:
 * 
 * 1. "Authorization failed"
 *    → Check your SUPABASE_ANON_KEY is correct
 *    → Make sure you copied the "anon" key, not "service_role"
 * 
 * 2. "Function not found"
 *    → Make sure you deployed the Edge Function:
 *      supabase functions deploy sync-prayer-requests
 * 
 * 3. "Trigger not firing"
 *    → Check the trigger is set to "On form submit" not "On edit"
 *    → Try submitting a test form response
 *    → Check "Executions" to see if it ran
 * 
 * 4. "Missing configuration"
 *    → Make sure Edge Function secrets are set:
 *      GOOGLE_SHEETS_API_KEY
 *      PRAYER_REQUESTS_SHEET_ID
 */
