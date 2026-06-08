// Commission split for a successful (billed) OTP.
// Pays each tier in the allocation chain:
//   - Admin earns: agent_rate - panel_payout
//   - Agent earns: client_rate - agent_rate
//   - Client is charged: client_rate (debit, recorded as 'client_charge')
// Credits land in profiles.balance and clients.balance (if column exists).
// Writes a per-tier audit row in commission_ledger.

const db = require('./db');

async function splitCommissionForOtp({ otp_audit_id, phone_number }) {
  if (!phone_number) return { ok: false, reason: 'no phone' };
  try {
    const np = await db.prepare(
      `SELECT id, panel_payout, agent_rate, client_rate,
              assigned_agent, assigned_client
       FROM number_pool
       WHERE number = ? OR number LIKE ?
       ORDER BY (number = ?) DESC, updated_at DESC
       LIMIT 1`
    ).get(phone_number, `%${phone_number.slice(-9)}`, phone_number);

    if (!np) return { ok: false, reason: 'number not in pool' };

    const panelRate  = Number(np.panel_payout) || 0;
    const agentRate  = Number(np.agent_rate)   || 0;
    const clientRate = Number(np.client_rate)  || 0;

    const adminEarn  = agentRate  > 0 ? +(agentRate  - panelRate).toFixed(4) : 0;
    const agentEarn  = clientRate > 0 ? +(clientRate - agentRate).toFixed(4) : 0;
    const clientPay  = clientRate > 0 ? clientRate : agentRate;

    const writes = [];

    // Admin profit (only meaningful when agent_rate exists)
    if (adminEarn > 0) {
      // Resolve the root admin profile (oldest is_admin=true row)
      const adminRow = await db.prepare(
        `SELECT id FROM profiles
         WHERE is_admin = true OR role = 'admin'
         ORDER BY created_at ASC NULLS LAST
         LIMIT 1`
      ).get();
      const adminUserId = adminRow?.id || null;

      writes.push(db.prepare(
        `INSERT INTO commission_ledger
          (otp_audit_id, number_pool_id, phone_number, tier, user_id, amount)
         VALUES (?, ?, ?, 'admin', ?, ?)`
      ).run(otp_audit_id || null, np.id, phone_number, adminUserId, adminEarn));

      if (adminUserId) {
        writes.push(db.prepare(
          `UPDATE profiles SET balance = COALESCE(balance,0) + ? WHERE id = ?`
        ).run(adminEarn, adminUserId));
      }
    }

    // Agent profit + balance credit
    if (agentEarn > 0 && np.assigned_agent) {
      writes.push(db.prepare(
        `INSERT INTO commission_ledger
          (otp_audit_id, number_pool_id, phone_number, tier, user_id, amount)
         VALUES (?, ?, ?, 'agent', ?, ?)`
      ).run(otp_audit_id || null, np.id, phone_number, np.assigned_agent, agentEarn));
      writes.push(db.prepare(
        `UPDATE profiles SET balance = COALESCE(balance,0) + ? WHERE id = ?`
      ).run(agentEarn, np.assigned_agent));
    }

    // Client charge (debit recorded; clients.balance reduced if column exists)
    if (clientPay > 0 && np.assigned_client) {
      writes.push(db.prepare(
        `INSERT INTO commission_ledger
          (otp_audit_id, number_pool_id, phone_number, tier, client_id, amount)
         VALUES (?, ?, ?, 'client_charge', ?, ?)`
      ).run(otp_audit_id || null, np.id, phone_number, np.assigned_client, clientPay));
      // Best-effort balance debit; ignore if clients has no balance column
      try {
        await db.prepare(
          `UPDATE clients SET balance = COALESCE(balance,0) - ? WHERE id = ?`
        ).run(clientPay, np.assigned_client);
      } catch (_) {}
    }

    await Promise.all(writes);
    return {
      ok: true,
      panel: panelRate,
      admin_earn: adminEarn,
      agent_earn: agentEarn,
      client_pay: clientPay,
    };
  } catch (err) {
    console.error('[commission] split failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

// Legacy stub kept for any old caller
async function agentPayout() {
  return { agent_amount: 0, rate_id: null, percent: 0, base: 0 };
}

module.exports = { splitCommissionForOtp, agentPayout };
