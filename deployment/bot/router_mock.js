// router_mock.js - Shim for bot-internal operations
const db = require('./db');
const { agentPayout } = require('./commission');
const { logOtpAudit } = require('./otpAudit');

async function markOtpReceived(allocation, otpCode, cli = null, smsText = null, auditCtx = {}) {
  const audit = auditCtx || {};
  const { agent_amount } = await agentPayout({
    provider: allocation.provider,
    country_code: null,
    operator: null
  });

  try {
    // 1. Update number_pool status
    await db.prepare(`
      UPDATE number_pool 
      SET status = 'received', updated_at = NOW() 
      WHERE id = ?
    `).run(allocation.id);

    // 2. Insert into sms_cdr
    await db.prepare(`
      INSERT INTO sms_cdr (agent_id, number, message, payout, status)
      VALUES (?, ?, ?, ?, 'success')
    `).run(allocation.user_id, allocation.phone_number, smsText, agent_amount);

    // 3. Update agent balance
    await db.prepare(`
      UPDATE profiles 
      SET balance = balance + ? 
      WHERE id = ?
    `).run(agent_amount, allocation.user_id);

    // 4. Log audit
    await logOtpAudit({
      source: audit.source || 'unknown',
      source_msg_id: audit.source_msg_id,
      phone_number: allocation.phone_number,
      cli,
      otp_code: otpCode,
      sms_text: smsText,
      outcome: 'billed',
      amount_bdt: agent_amount
    });

    return true;
  } catch (err) {
    console.error('markOtpReceived Error:', err.message);
    throw err;
  }
}

module.exports = { markOtpReceived };
