const db = require('./db');
const { getOtpExpirySec } = require('./settings');

function normalizeTail(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? digits.slice(-9) : null;
}

function normalizeDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function samePhone(a, b) {
  const left = normalizeDigits(a);
  const right = normalizeDigits(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(right) || right.endsWith(left);
}

function sameRange(panelRange, allocation) {
  return true; // Simplified for now
}

function inferServiceSlug(cli, msg) {
  const hay = `${cli || ''} ${msg || ''}`.toLowerCase();
  if (/whats\s*app|wa\b/.test(hay)) return 'whatsapp';
  if (/facebook|fb\b|meta/.test(hay)) return 'facebook';
  if (/instagram|insta\b/.test(hay)) return 'instagram';
  if (/telegram/.test(hay)) return 'telegram';
  if (/google|gmail|youtube/.test(hay)) return 'google';
  if (/tiktok/.test(hay)) return 'tiktok';
  if (/twitter|\bx\b/.test(hay)) return 'twitter';
  return null;
}

async function findMatchingAllocation({
  provider,
  phone,
  cliSlug = null,
  panelRange = null
}) {
  const tail = normalizeTail(phone);
  if (!tail) return null;

  try {
    // Search number_pool for numbers matching the tail
    // Safeguard: Must be 'reserved' or 'available' (if system allows auto-assign)
    // For Shark SMS, we check active status or reserved
    const query = `
      SELECT id, number as phone_number, user_id, reserved_for, service_tag as service_slug
      FROM number_pool
      WHERE (status = 'reserved' OR status = 'available') AND number LIKE ?
      LIMIT 1
    `;
    const res = await db.prepare(query).get(`%${tail}`);
    if (res) {
      return {
        id: res.id,
        phone_number: res.phone_number,
        user_id: res.reserved_for || res.user_id, // Ensure user ID is correctly mapped from reservation
        provider: provider,
        service_id: null
      };
    }
  } catch (err) {
    console.error('findMatchingAllocation Error:', err.message);
  }
  return null;
}

async function hasSeenSourceMessage(source, sourceMsgId) {
  if (!source || !sourceMsgId) return false;
  try {
    const row = await db.prepare(
      `SELECT 1 FROM otp_audit_log WHERE source = ? AND source_msg_id = ? LIMIT 1`
    ).get(String(source), String(sourceMsgId));
    return !!row;
  } catch (_) {
    return false;
  }
}

module.exports = {
  findMatchingAllocation,
  hasSeenSourceMessage,
  inferServiceSlug,
  normalizeDigits,
};
