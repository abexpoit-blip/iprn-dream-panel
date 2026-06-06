// Shared settings helpers — reads from bot_settings table or env.
const db = require('./db');

async function getSetting(bot_id, key, fallback) {
  try {
    const row = await db.prepare('SELECT setting_value FROM bot_settings WHERE bot_id = ? AND setting_key = ?').get(bot_id, key);
    return row ? row.setting_value : fallback;
  } catch (_) {
    return fallback;
  }
}

async function getOtpExpirySec() {
  // Global setting fallback
  return 600; 
}

async function getRecentOtpHours() {
  return 24;
}

module.exports = {
  getOtpExpirySec,
  getRecentOtpHours,
  getSetting
};
