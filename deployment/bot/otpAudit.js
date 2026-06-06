const db = require('./db');

/**
 * outcome ∈ 'billed' | 'duplicate' | 'resend' | 'mismatch' | 'error'
 */
async function logOtpAudit({
  source, source_msg_id = null, phone_number = null, cli = null,
  otp_code = null, sms_text = null, allocation_id = null, user_id = null,
  outcome, miss_reason = null, amount_bdt = null, is_fake = 0,
}) {
  try {
    // Note: The table schema found in PSQL (otp_audit_log) has different column names:
    // id, bot_id, source, source_msg_id, phone_number, cli, otp_code, sms_text, outcome, amount_earned, created_at
    // We map amount_bdt to amount_earned and skip missing columns like allocation_id/user_id for now if they don't exist.
    
    const query = `
      INSERT INTO otp_audit_log 
        (source, source_msg_id, phone_number, cli, otp_code, sms_text, outcome, amount_earned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const info = await db.prepare(query).run(
      String(source), 
      source_msg_id ? String(source_msg_id) : null,
      phone_number, 
      cli, 
      otp_code,
      sms_text ? String(sms_text).slice(0, 1000) : null,
      String(outcome),
      amount_bdt || 0
    );
    
    return info.lastInsertRowid || null;
  } catch (e) {
    console.error('[otp-audit] write failed:', e.message);
    return null;
  }
}

module.exports = { logOtpAudit };
