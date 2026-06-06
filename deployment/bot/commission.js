// Calculate agent payout for a successful OTP based on rate card
const db = require('./db');

async function findRate({ provider, country_code, operator }) {
  // Map our schema (sms_ranges) to the expected logic
  // The logic in imsBot uses 'ims' as provider. 
  // We'll look for ranges with matching prefix if possible, or just default.
  try {
    const rows = await db.prepare("SELECT * FROM sms_ranges ORDER BY created_at DESC").all();
    if (rows && rows.length > 0) return rows[0]; // Simplification for now
    return null;
  } catch (err) {
    return null;
  }
}

async function agentPayout({ provider, country_code, operator }) {
  const rate = await findRate({ provider, country_code, operator });
  if (!rate) return { agent_amount: 0.01, rate_id: null, percent: 100, base: 0.01 };
  
  // Use payout_1_1 as a baseline amount
  const base = +rate.payout_1_1 || 0.01;
  return { agent_amount: base, rate_id: rate.id, percent: 100, base };
}

module.exports = { findRate, agentPayout };
