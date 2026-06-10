const db = require('./db');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

async function mirrorOtpToSmsCdr({
  source, source_msg_id, phone_number, cli, otp_code, sms_text, outcome, amount_bdt,
}) {
  if (!phone_number) return null;
  try {
    const phoneDigits = digitsOnly(phone_number);
    const owner = phoneDigits
      ? await db.prepare(
          `SELECT prefix, assigned_agent, assigned_client, client_rate, agent_rate, panel_payout
           FROM number_pool
           WHERE regexp_replace(COALESCE(number, ''), '[^0-9]', '', 'g') LIKE ?
           ORDER BY updated_at DESC NULLS LAST, created_at DESC
           LIMIT 1`
        ).get(`%${phoneDigits.slice(-9)}`)
      : null;

    const payout = Number(amount_bdt || owner?.client_rate || owner?.agent_rate || owner?.panel_payout || 0) || 0;
    const status = String(outcome) === 'billed' ? 'delivered' : String(outcome || 'unknown');
    const prefix = owner?.prefix || phoneDigits.slice(0, 3) || null;

    const row = await db.prepare(
      `INSERT INTO sms_cdr
        (source, source_msg_id, phone_number, number, otp_code, cli, message, payout, price_bdt, status, received_at, created_at, prefix, agent_id, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)
       ON CONFLICT (source, source_msg_id) WHERE source_msg_id IS NOT NULL
       DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         number = EXCLUDED.number,
         otp_code = EXCLUDED.otp_code,
         cli = EXCLUDED.cli,
         message = EXCLUDED.message,
         payout = EXCLUDED.payout,
         price_bdt = EXCLUDED.price_bdt,
         status = EXCLUDED.status,
         prefix = EXCLUDED.prefix,
         agent_id = EXCLUDED.agent_id,
         client_id = EXCLUDED.client_id
       RETURNING id`
    ).run(
      String(source),
      source_msg_id ? String(source_msg_id) : null,
      phone_number,
      phone_number,
      otp_code,
      cli,
      sms_text ? String(sms_text).slice(0, 1000) : null,
      payout,
      payout,
      status,
      prefix,
      owner?.assigned_agent || null,
      owner?.assigned_client || null,
    );
    return row.lastInsertRowid || null;
  } catch (e) {
    console.error('[otp-audit] sms_cdr mirror failed:', e.message);
    return null;
  }
}

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

    await mirrorOtpToSmsCdr({
      source: normalizedSource,
      source_msg_id: normalizedMsgId,
      phone_number,
      cli,
      otp_code,
      sms_text,
      outcome,
      amount_bdt,
    });

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
