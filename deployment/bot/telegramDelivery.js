// Telegram OTP push for VIP agents using their own bot token + chat_id.
// Fire-and-forget: never blocks OTP credit transaction.
const db = require('./db');

async function sendTelegram(token, chatId, text) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: ctrl.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      const err = j.description || `HTTP ${r.status}`;
      throw new Error(err);
    }
    return { ok: true, message_id: j.result?.message_id };
  } finally {
    clearTimeout(timeout);
  }
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Fire-and-forget OTP push to a user's configured Telegram bot.
function pushOtpToUser(userId, payload) {
  try {
    const u = db.prepare(
      `SELECT id, username, is_vip, tg_bot_token, tg_chat_id FROM users WHERE id = ?`
    ).get(userId);
    if (!u || !u.is_vip || !u.tg_bot_token || !u.tg_chat_id) return;

    const lines = [
      `🔔 <b>OTP received</b>`,
      ``,
      `📱 <b>Number:</b> <code>${escHtml(payload.phone_number)}</code>`,
      `🔑 <b>OTP:</b> <code>${escHtml(payload.otp)}</code>`,
    ];
    if (payload.cli)        lines.push(`🏷️ <b>Service:</b> ${escHtml(payload.cli)}`);
    if (payload.country)    lines.push(`🌍 <b>Country:</b> ${escHtml(payload.country)}`);
    if (payload.operator)   lines.push(`📡 <b>Operator:</b> ${escHtml(payload.operator)}`);
    if (payload.sms_text) {
      lines.push(``, `<b>Full SMS:</b>`, `<pre>${escHtml(payload.sms_text).slice(0, 1000)}</pre>`);
    }
    const text = lines.join('\n');

    sendTelegram(u.tg_bot_token, u.tg_chat_id, text).catch((e) => {
      console.warn(`[tg-push] user=${u.username} failed: ${e.message}`);
    });
  } catch (e) {
    console.warn(`[tg-push] error: ${e.message}`);
  }
}

module.exports = { sendTelegram, pushOtpToUser };