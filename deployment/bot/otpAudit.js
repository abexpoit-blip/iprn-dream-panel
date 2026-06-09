const db = require('./db');

/**
 * Logs an OTP event and (when outcome='billed') runs the commission split
 * across the Admin → Agent → Client allocation chain.
 */
async function logOtpAudit({
  source, source_msg_id = null, phone_number = null, cli = null,
  otp_code = null, sms_text = null, allocation_id = null, user_id = null,
  outcome, miss_reason = null, amount_bdt = null, is_fake = 0,
}) {
  try {
    // Hard DB-level dedup: unique index on (source, source_msg_id).
    // ON CONFLICT DO NOTHING guarantees no double row even under race conditions
    // (e.g. two scrape ticks running concurrently against the same CDR row).
    const query = `
      INSERT INTO otp_audit_log
        (source, source_msg_id, phone_number, cli, otp_code, sms_text, outcome, amount_earned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (source, source_msg_id) WHERE source_msg_id IS NOT NULL
        DO NOTHING
      RETURNING id
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

    const auditId = info.lastInsertRowid || null;
    // Conflict path → no row inserted, skip downstream side-effects.
    if (!auditId) return null;


    // On a successful (billed) OTP, split commission across the allocation chain.
    if (String(outcome) === 'billed' && phone_number) {
      try {
        const { splitCommissionForOtp } = require('./commission');
        const r = await splitCommissionForOtp({ otp_audit_id: auditId, phone_number });
        if (r && r.ok) {
          console.log(`[commission] ${phone_number} → admin=${r.admin_earn} agent=${r.agent_earn} client_pay=${r.client_pay}`);
        }
      } catch (e) {
        console.error('[commission] hook failed:', e.message);
      }
    }

    return auditId;
  } catch (e) {
    console.error('[otp-audit] write failed:', e.message);
    return null;
  }
}

module.exports = { logOtpAudit };
