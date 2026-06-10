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
    const normalizedSource = String(source);
    const normalizedMsgId = source_msg_id ? String(source_msg_id) : null;
    const payload = [
      normalizedSource,
      normalizedMsgId,
      phone_number,
      cli,
      otp_code,
      sms_text ? String(sms_text).slice(0, 1000) : null,
      String(outcome),
      amount_bdt || 0,
    ];

    // Some deployed databases still miss the partial unique index needed by
    // ON CONFLICT (source, source_msg_id). To keep OTP auto-sync working, do a
    // SQL-level dedupe fallback that works even before the index exists.
    const query = normalizedMsgId
      ? `
          INSERT INTO otp_audit_log
            (source, source_msg_id, phone_number, cli, otp_code, sms_text, outcome, amount_earned)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1
            FROM otp_audit_log
            WHERE source = ? AND source_msg_id = ?
          )
          RETURNING id
        `
      : `
          INSERT INTO otp_audit_log
            (source, source_msg_id, phone_number, cli, otp_code, sms_text, outcome, amount_earned)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `;

    const info = await db.prepare(query).run(
      ...(normalizedMsgId ? [...payload, normalizedSource, normalizedMsgId] : payload)
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
