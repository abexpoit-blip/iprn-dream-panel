// Shark SMS Bot — AGENT-mode scraper.
// Logs in as a Shark agent account and pulls:
//   - Numbers from /ints/agent/res/data_smsnumbers.php  → number_pool
//   - OTPs    from /ints/agent/res/data_smscdr.php      → otp_audit_log
// Both endpoints are DataTables server-side JSON: { aaData: [[col0, col1, ...], ...] }.
//
// CDR columns (7): [Date, Range, Number, CLI, SMS, Currency, MyPayout]
//   Last row is a totals row "usd,eur,gbp,totsms" — skipped.
// Numbers columns (6): [Range, Prefix, Number, MyPayterm, MyPayout, Limits]

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { getSetting } = require('./settings');
const { logOtpAudit } = require('./otpAudit');
const { pushOtpToUser } = require('./telegramDelivery');
const db = require('./db');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true, timeout: 20000 }));

let isActive = false;
let BOT_ID = null;
const BOT_NAME = 'Shark SMS Bot';
const BOT_TYPE = 'shark';
let PANEL_MODE = 'client'; // 'agent' or 'client'. Overridable via bot_settings.panel_mode

async function resolvePanelMode() {
  try {
    const v = await getSetting(BOT_ID, 'panel_mode', '');
    const m = String(v || '').trim().toLowerCase();
    if (m === 'agent' || m === 'client') PANEL_MODE = m;
  } catch (_) {}
  console.log(`[shark-bot] PANEL_MODE=${PANEL_MODE}`);
}


async function updateBotStatus(status, error = null) {
  if (!BOT_ID) return;
  try {
    await db.prepare("UPDATE bots SET status = ?, last_seen = NOW(), last_error = ? WHERE id = ?")
      .run(status, error, BOT_ID);
  } catch (_) { /* ignore */ }
}

function parseCookieString(cookieStr, urlOrigin) {
  if (!cookieStr) return 0;
  const parts = cookieStr.split(';').map(s => s.trim()).filter(Boolean);
  let count = 0;
  for (const part of parts) {
    try { jar.setCookieSync(part, urlOrigin); count++; } catch (_) {}
  }
  return count;
}

function getAttr(tag, name) {
  const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : '';
}

function extractLoginForm(html, pageUrl) {
  const formHtml = (html.match(/<form[\s\S]*?<\/form>/i) || [html])[0];
  const formOpen = (formHtml.match(/<form[^>]*>/i) || [''])[0];
  const action = getAttr(formOpen, 'action') || pageUrl;
  const postUrl = new URL(action, pageUrl).toString();
  const fields = {};
  const inputs = formHtml.match(/<input\b[^>]*>/gi) || [];
  for (const i of inputs) {
    const name = getAttr(i, 'name');
    if (!name) continue;
    const type = (getAttr(i, 'type') || '').toLowerCase();
    if (type === 'hidden') fields[name] = getAttr(i, 'value');
  }
  const captchaField = inputs.map(i => getAttr(i, 'name')).find(n => ['capt', 'captcha'].includes(n)) || 'capt';
  const mathMatch = formHtml.match(/(\d+)\s*\+\s*(\d+)\s*=\s*\?/) || html.match(/(\d+)\s*\+\s*(\d+)\s*=\s*\?/);
  const hasImageCaptcha = /<img[^>]+captcha/i.test(formHtml) || /captcha\.(png|jpg|jpeg|gif|svg)/i.test(formHtml);
  return { postUrl, fields, captchaField, mathMatch, hasImageCaptcha };
}

async function verifySession(origin) {
  const probe = `${origin}/ints/${PANEL_MODE}/MySMSNumbers`;
  const r = await client.get(probe, { validateStatus: () => true, maxRedirects: 0 });
  const loc = r.headers?.location || '';
  const bodyStr = typeof r.data === 'string' ? r.data : '';
  const ok = r.status === 200 && /MySMSNumbers|Logout|Dashboard|SMSCDRStats/i.test(bodyStr);
  console.log(`[shark-bot] verifySession probe=${probe} status=${r.status} redirect=${loc || '-'} bodyLen=${bodyStr.length} ok=${ok}`);
  if (!ok && bodyStr.length > 0 && bodyStr.length < 400) {
    console.log(`[shark-bot] verifySession body preview: ${bodyStr.slice(0, 200).replace(/\s+/g, ' ')}`);
  }
  return ok;
}

async function login() {
  const user = await getSetting(BOT_ID, 'username', 'Shovonkhan');
  const pass = await getSetting(BOT_ID, 'password', 'Shovonkhan');
  const url  = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
  const sessionCookie = await getSetting(BOT_ID, 'session_cookie', '');
  const manualCaptcha = await getSetting(BOT_ID, 'captcha_token', '');
  const origin = new URL(url).origin;

  // Option A — pasted session cookie
  if (sessionCookie && sessionCookie.trim().length > 5) {
    const n = parseCookieString(sessionCookie.trim(), origin);
    console.log(`[shark-bot] Using pasted session cookie (${n} entries) — skipping login form`);
    if (await verifySession(origin)) {
      console.log(`[shark-bot] Session cookie verified — logged in as ${PANEL_MODE}`);
      await updateBotStatus('online', null);
      return true;
    }
    const reason = 'Pasted session cookie rejected. Paste a fresh PHPSESSID.';
    console.error(`[shark-bot] ${reason}`);
    await updateBotStatus('offline', reason);
    return false;
  }

  console.log(`[shark-bot] Attempting login for ${user} at ${url} (mode=${PANEL_MODE})`);
  try {
    const loginPage = await client.get(url, { validateStatus: () => true });
    const pageBody = typeof loginPage.data === 'string' ? loginPage.data : '';
    const form = extractLoginForm(pageBody, url);

    let captchaResult = '';
    if (manualCaptcha && manualCaptcha.trim()) {
      captchaResult = manualCaptcha.trim();
    } else if (form.mathMatch) {
      captchaResult = String(parseInt(form.mathMatch[1], 10) + parseInt(form.mathMatch[2], 10));
      console.log(`[shark-bot] Solved math captcha: ${form.mathMatch[1]}+${form.mathMatch[2]}=${captchaResult}`);
    } else if (form.hasImageCaptcha) {
      const reason = 'Image captcha detected — paste session_cookie or captcha_token in bot_settings';
      console.error(`[shark-bot] ${reason}`);
      await updateBotStatus('offline', reason);
      return false;
    }

    const payload = new URLSearchParams({ ...form.fields, username: user, password: pass });
    if (captchaResult) payload.set(form.captchaField, captchaResult);

    const res = await client.post(form.postUrl, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': url, 'Origin': origin },
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const finalPath = res.request?.path || '';
    const body = typeof res.data === 'string' ? res.data : '';
    const ok = await verifySession(origin) ||
               finalPath.includes(`/${PANEL_MODE}`) ||
               /Logout|logout|Dashboard/.test(body);

    if (ok) {
      console.log(`[shark-bot] Login successful (status=${res.status}, path=${finalPath})`);
      await updateBotStatus('online', null);
      return true;
    }
    const reason = `Login rejected (status=${res.status}, path=${finalPath}). Wrong creds or captcha — paste PHPSESSID via bot_settings.session_cookie.`;
    console.error(`[shark-bot] ${reason}`);
    await updateBotStatus('offline', reason);
    return false;
  } catch (err) {
    console.error(`[shark-bot] Login error:`, err.message);
    await updateBotStatus('offline', `Network error: ${err.message}`);
    return false;
  }
}

// Pull a DataTables endpoint and return the parsed aaData rows.
async function fetchDataTables(url, referer, extraParams = {}) {
  const params = new URLSearchParams({
    sEcho: '1',
    iColumns: '10',
    iDisplayStart: '0',
    iDisplayLength: '500',
    sSearch: '',
    iSortingCols: '1',
    iSortCol_0: '0',
    sSortDir_0: 'desc',
    ...extraParams,
  });
  const full = url + (url.includes('?') ? '&' : '?') + params.toString();
  const r = await client.get(full, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': referer,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
    validateStatus: () => true,
  });
  return { status: r.status, body: r.data, url: full };
}

function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').trim(); }

// ---------- NUMBERS ----------
async function scrapeNumbers() {
  if (!isActive || !BOT_ID) return;
  const loginUrl = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
  const origin   = new URL(loginUrl).origin;
  const url      = `${origin}/ints/${PANEL_MODE}/res/data_smsnumbers.php?frange=&fclient=`;
  const referer  = `${origin}/ints/${PANEL_MODE}/MySMSNumbers`;

  try {
    const res = await fetchDataTables(url, referer);
    if (res.status !== 200) {
      console.error(`[shark-bot] Numbers HTTP ${res.status}`);
      if (res.status === 401 || res.status === 302) await login();
      return;
    }
    const data = typeof res.body === 'object' ? res.body : JSON.parse(res.body);
    const rows = Array.isArray(data.aaData) ? data.aaData : [];

    // Columns: [Range, Prefix, Number, Payterm, Payout, Limits]
    const items = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const rangeName = stripHtml(row[0]);
      const prefix    = digitsOnly(stripHtml(row[1]));
      const num       = digitsOnly(stripHtml(row[2]));
      const payout    = parseFloat(stripHtml(row[4] || '').replace(/[^\d.]/g, '')) || null;
      if (!num) continue;
      const full = num.startsWith(prefix) ? num : (prefix + num);
      if (full.length < 6) continue;
      // Country: take the first token of the Range string (e.g. "UK-EE" → "UK", "Bangladesh GP" → "Bangladesh")
      const country = (rangeName || '').split(/[-_ /|]/)[0].trim() || null;
      items.push({ number: full, range_name: rangeName || null, prefix: prefix || null, country, panel_payout: payout });
    }

    if (items.length === 0) {
      console.log(`[shark-bot] Numbers scrape: 0 rows from ${url} (panel has no numbers yet)`);
      return;
    }

    let inserted = 0;
    for (const it of items) {
      try {
        const r = await db.prepare(
          `INSERT INTO number_pool (number, status, bot_id, range_name, prefix, country, panel_payout)
           VALUES (?, 'available', ?, ?, ?, ?, ?)
           ON CONFLICT (number) DO UPDATE SET
             bot_id = EXCLUDED.bot_id,
             range_name = COALESCE(EXCLUDED.range_name, number_pool.range_name),
             prefix = COALESCE(EXCLUDED.prefix, number_pool.prefix),
             country = COALESCE(EXCLUDED.country, number_pool.country),
             panel_payout = COALESCE(EXCLUDED.panel_payout, number_pool.panel_payout),
             updated_at = NOW()
           RETURNING number`
        ).run(it.number, BOT_ID, it.range_name, it.prefix, it.country, it.panel_payout);
        if (r.changes) inserted++;
      } catch (_) {}
    }
    console.log(`[shark-bot] Numbers scrape: ${items.length} parsed, ${inserted} upserted into number_pool (with country/range/payout)`);
  } catch (err) {
    console.error(`[shark-bot] Numbers scrape error:`, err.message);
  }
}

// ---------- OTP / SMS CDR ----------
function todayRange() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { from: `${yyyy}-${mm}-${dd} 00:00:00`, to: `${yyyy}-${mm}-${dd} 23:59:59` };
}

async function alreadyLogged(sourceMsgId) {
  try {
    const row = await db.prepare(
      `SELECT 1 FROM otp_audit_log WHERE source = 'shark' AND source_msg_id = ? LIMIT 1`
    ).get(sourceMsgId);
    return !!row;
  } catch (_) { return false; }
}

async function scrapeSms() {
  if (!isActive || !BOT_ID) return;
  const loginUrl = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
  const origin   = new URL(loginUrl).origin;
  const { from, to } = todayRange();
  const base = `${origin}/ints/${PANEL_MODE}/res/data_smscdr.php`
    + `?fdate1=${encodeURIComponent(from)}&fdate2=${encodeURIComponent(to)}`
    + `&frange=&fnum=&fcli=&fgdate=&fgmonth=&fgrange=&fgnumber=&fgcli=&fg=0`;
  const referer = `${origin}/ints/${PANEL_MODE}/SMSCDRStats`;

  try {
    const res = await fetchDataTables(base, referer, { iColumns: '7' });
    if (res.status !== 200) {
      console.error(`[shark-bot] CDR HTTP ${res.status}`);
      if (res.status === 401 || res.status === 302) await login();
      return;
    }
    const data = typeof res.body === 'object' ? res.body : JSON.parse(res.body);
    const rows = Array.isArray(data.aaData) ? data.aaData : [];
    await updateBotStatus('online', null);

    // Last row is totals "usd,eur,gbp,totsms" → skip if first cell looks like CSV totals.
    const realRows = rows.filter(r => {
      if (!Array.isArray(r) || r.length < 5) return false;
      const c0 = String(r[0] || '');
      // Real date col looks like "YYYY-MM-DD HH:MM:SS"; totals row is "x,y,z,n"
      return /\d{4}-\d{2}-\d{2}/.test(c0);
    });

    let billed = 0, dup = 0;
    for (const row of realRows) {
      const dateStr = stripHtml(row[0]);
      const range   = stripHtml(row[1]);
      const phone   = digitsOnly(stripHtml(row[2]));
      const cli     = stripHtml(row[3]);
      const smsText = stripHtml(row[4]);
      if (!phone || !smsText) continue;

      const sourceMsgId = `${dateStr}|${phone}|${cli}`;
      if (await alreadyLogged(sourceMsgId)) { dup++; continue; }

      const otpMatch = smsText.match(/\b(\d{3}[- ]?\d{3,4}|\d{4,8})\b/);
      const otpCode  = otpMatch ? otpMatch[1].replace(/[- ]/g, '') : null;

      // Find owner of this number (if any) from number_pool
      let userId = null;
      try {
        const owner = await db.prepare(
          `SELECT reserved_for, user_id FROM number_pool WHERE number LIKE ? LIMIT 1`
        ).get(`%${phone.slice(-9)}`);
        userId = owner?.reserved_for || owner?.user_id || null;
      } catch (_) {}

      await logOtpAudit({
        source: 'shark',
        source_msg_id: sourceMsgId,
        phone_number: phone,
        cli,
        otp_code: otpCode,
        sms_text: smsText,
        user_id: userId,
        outcome: otpCode ? 'billed' : 'mismatch',
        amount_bdt: 0,
      });
      if (otpCode) {
        billed++;
        if (userId) {
          try { pushOtpToUser(userId, { phone_number: phone, otp: otpCode, cli, sms_text: smsText }); } catch (_) {}
        }
      }
    }
    console.log(`[shark-bot] CDR scrape: rows=${realRows.length}, billed=${billed}, dup=${dup}`);
  } catch (err) {
    console.error(`[shark-bot] CDR scrape error:`, err.message);
  }
}

// ---------- BOOTSTRAP ----------
async function start() {
  isActive = true;
  console.log('[shark-bot] Bot starting (CLIENT mode)...');

  try {
    let existing = await db.prepare('SELECT id FROM bots WHERE bot_type = ? LIMIT 1').get(BOT_TYPE);
    if (!existing) {
      const newId = require('crypto').randomUUID();
      await db.prepare('INSERT INTO bots (id, name, bot_type, status) VALUES (?, ?, ?, ?)')
        .run(newId, BOT_NAME, BOT_TYPE, 'offline');
      BOT_ID = newId;
    } else {
      BOT_ID = existing.id;
    }
    console.log(`[shark-bot] BOT_ID=${BOT_ID}`);
  } catch (err) {
    console.error('[shark-bot] Failed to resolve BOT_ID:', err.message);
    return;
  }

  await resolvePanelMode();

  const ok = await login();
  if (!ok) return;


  // One-time number pool seed at startup. After that, number scraping is
  // ON-DEMAND ONLY — triggered by the admin clicking "Start Auto Pool"
  // (NOTIFY scrape_now). No periodic background number polling.
  scrapeNumbers();

  // OTP/SMS auto-sync stays on a fast 15s loop.
  scrapeSms();
  setInterval(scrapeSms, 15000);

  // Auto-pool trigger from UI
  try {
    const { sql } = require('./db');
    await sql.listen('scrape_now', () => {
      console.log('[shark-bot] [auto-pool] NOTIFY scrape_now received');
      scrapeNumbers();
    });
    console.log('[shark-bot] [auto-pool] listening on channel scrape_now');
  } catch (e) {
    console.error('[shark-bot] [auto-pool] LISTEN failed:', e.message);
  }
}

module.exports = { start, stop: () => { isActive = false; } };
