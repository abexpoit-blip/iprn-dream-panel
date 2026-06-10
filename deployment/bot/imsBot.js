// IMS SMS Bot — AGENT-mode scraper.
// Logs in as an IMS agent account and pulls:
//   - Numbers from /agent/res/data_smsnumbers.php → number_pool
//   - OTPs    from /agent/res/data_smscdr.php    → otp_audit_log
// Both endpoints are DataTables server-side JSON. Same shape as Shark.
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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  timeout: 25000,
  headers: {
    'User-Agent': UA,
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
}));

let isActive = false;
let BOT_ID = null;
const BOT_NAME = 'IMS Main Agent';
const BOT_TYPE = 'ims';
let PANEL_MODE = 'client'; // 'agent' (reseller) or 'client'. Overridable via bot_settings.panel_mode

async function resolvePanelMode() {
  try {
    const v = await getSetting(BOT_ID, 'panel_mode', '');
    const m = String(v || '').trim().toLowerCase();
    if (m === 'agent' || m === 'client') {
      PANEL_MODE = m;
    }
  } catch (_) {}
  console.log(`[ims-bot] PANEL_MODE=${PANEL_MODE}`);
}


// IMS blocks if any page is refreshed < ~16s. Keep a separate throttle per endpoint.
const IMS_MIN_INTERVAL_MS = 20000;
const IMS_NUMBERS_MIN_INTERVAL_MS = 20000;
let lastSmsScrape = 0;
let lastNumbersScrape = 0;
let lastKeepAlive = 0;
let lastLoginAt = 0;
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // ping every 4min to keep PHPSESSID warm
const SESSION_MAX_AGE_MS = 50 * 60 * 1000;    // proactively re-login after 50min

async function updateBotStatus(status, error = null) {
  if (!BOT_ID) return;
  try {
    await db.prepare("UPDATE bots SET status = ?, last_seen = NOW(), last_error = ? WHERE id = ?")
      .run(status, error, BOT_ID);
  } catch (_) {}
}

// Persist live sync metrics so the admin sync-status page can subscribe in realtime.
async function writeSyncStatus(patch) {
  if (!BOT_ID) return;
  try {
    const cols = Object.keys(patch);
    const vals = Object.values(patch);
    const setParts = cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const colList = cols.join(', ');
    await db.prepare(
      `INSERT INTO bot_sync_status (bot_id, bot_type, scope, ${colList}, updated_at)
       VALUES (?, ?, 'cdr', ${placeholders}, NOW())
       ON CONFLICT (bot_id) DO UPDATE SET ${setParts}, updated_at = NOW()`
    ).run(BOT_ID, BOT_TYPE, ...vals);
  } catch (e) {
    // Non-fatal — status table may not exist yet in older deploys.
  }
}

// Exponential backoff: 1s, 2s, 4s, 8s (capped). Jittered to avoid sync storms.
function backoffMs(attempt) {
  const base = Math.min(1000 * Math.pow(2, attempt), 8000);
  return base + Math.floor(Math.random() * 500);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const probe = `${origin}/${PANEL_MODE}/MySMSNumbers`;
  const r = await client.get(probe, { validateStatus: () => true, maxRedirects: 0 });
  const loc = r.headers?.location || '';
  const bodyStr = typeof r.data === 'string' ? r.data : '';
  const ok = r.status === 200 && /MySMSNumbers|Logout|Dashboard|SMSCDRStats/i.test(bodyStr);
  console.log(`[ims-bot] verifySession probe=${probe} status=${r.status} redirect=${loc || '-'} bodyLen=${bodyStr.length} ok=${ok}`);
  if (!ok && bodyStr.length > 0 && bodyStr.length < 400) {
    console.log(`[ims-bot] verifySession body preview: ${bodyStr.slice(0, 200).replace(/\s+/g, ' ')}`);
  }
  return ok;
}

async function login() {
  const user = await getSetting(BOT_ID, 'username', 'Shovonkhan');
  const pass = await getSetting(BOT_ID, 'password', 'Shovonkhan');
  const url  = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
  const sessionCookie = await getSetting(BOT_ID, 'session_cookie', '');
  const manualCaptcha = await getSetting(BOT_ID, 'captcha_token', '');
  const origin = new URL(url).origin;

  if (sessionCookie && sessionCookie.trim().length > 5) {
    const n = parseCookieString(sessionCookie.trim(), origin);
    console.log(`[ims-bot] Using pasted session cookie (${n} entries) — skipping login form`);
    if (await verifySession(origin)) {
      console.log(`[ims-bot] Session cookie verified — logged in as ${PANEL_MODE}`);
      await updateBotStatus('online', null);
      return true;
    }
    const reason = 'Pasted session cookie rejected. Paste a fresh PHPSESSID.';
    console.error(`[ims-bot] ${reason}`);
    await updateBotStatus('offline', reason);
    return false;
  }

  console.log(`[ims-bot] Attempting login for ${user} at ${url} (mode=${PANEL_MODE})`);
  try {
    const loginPage = await client.get(url, { validateStatus: () => true });
    const pageBody = typeof loginPage.data === 'string' ? loginPage.data : '';
    const form = extractLoginForm(pageBody, url);

    let captchaResult = '';
    if (manualCaptcha && manualCaptcha.trim()) {
      captchaResult = manualCaptcha.trim();
    } else if (form.mathMatch) {
      captchaResult = String(parseInt(form.mathMatch[1], 10) + parseInt(form.mathMatch[2], 10));
      console.log(`[ims-bot] Solved math captcha: ${form.mathMatch[1]}+${form.mathMatch[2]}=${captchaResult}`);
    } else if (form.hasImageCaptcha) {
      const reason = 'Image captcha detected — paste session_cookie or captcha_token in bot_settings';
      console.error(`[ims-bot] ${reason}`);
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
      console.log(`[ims-bot] Login successful (status=${res.status}, path=${finalPath})`);
      lastLoginAt = Date.now();
      await updateBotStatus('online', null);
      await writeSyncStatus({ session_alive: true, last_relogin_at: new Date().toISOString(), last_error: null });
      return true;
    }
    const reason = `Login rejected (status=${res.status}, path=${finalPath}). Wrong creds or captcha — paste PHPSESSID via bot_settings.session_cookie.`;
    console.error(`[ims-bot] ${reason}`);
    await updateBotStatus('offline', reason);
    return false;
  } catch (err) {
    console.error(`[ims-bot] Login error:`, err.message);
    await updateBotStatus('offline', `Network error: ${err.message}`);
    return false;
  }
}

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
  const origin = new URL(referer).origin;
  const r = await client.get(full, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': referer,
      'Origin': origin,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': UA,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
    },
    validateStatus: () => true,
  });
  return { status: r.status, body: r.data, url: full };
}

function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }
function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').trim(); }

async function upsertSmsRangesFromItems(items) {
  const byPrefix = new Map();
  for (const item of items) {
    if (!item.prefix && !item.range_name) continue;
    const key = item.prefix || item.range_name;
    if (!byPrefix.has(key)) byPrefix.set(key, item);
  }

  let synced = 0;
  for (const item of byPrefix.values()) {
    try {
      const prefix = item.prefix || item.range_name;
      await db.prepare(
        `INSERT INTO sms_ranges (prefix, name, test_number, currency, payout_7_1, payout_30_45, memo)
         VALUES (?, ?, ?, 'USD', ?, ?, ?)
         ON CONFLICT (prefix) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, sms_ranges.name),
           test_number = COALESCE(EXCLUDED.test_number, sms_ranges.test_number),
           payout_7_1 = COALESCE(EXCLUDED.payout_7_1, sms_ranges.payout_7_1),
           payout_30_45 = COALESCE(EXCLUDED.payout_30_45, sms_ranges.payout_30_45),
           memo = COALESCE(EXCLUDED.memo, sms_ranges.memo)
         RETURNING id`
      ).run(prefix, item.range_name, item.number, item.panel_payout, item.panel_payout, item.range_name);
      synced++;
    } catch (err) {
      console.error(`[ims-bot] Range sync failed (${item.prefix || item.range_name}):`, err.message);
    }
  }
  return synced;
}

// ---------- NUMBERS ----------
async function scrapeNumbers() {
  if (!isActive || !BOT_ID) return;
  // IMS blocks rapid refreshes (<~15s). Skip if last scrape was too recent.
  const now = Date.now();
  if (now - lastNumbersScrape < IMS_NUMBERS_MIN_INTERVAL_MS) {
    const wait = Math.ceil((IMS_NUMBERS_MIN_INTERVAL_MS - (now - lastNumbersScrape)) / 1000);
    console.log(`[ims-bot] Numbers scrape skipped — wait ${wait}s (IMS throttle)`);
    return;
  }
  lastNumbersScrape = now;

  const loginUrl = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
  const origin   = new URL(loginUrl).origin;
  const url      = `${origin}/${PANEL_MODE}/res/data_smsnumbers.php?frange=&fclient=`;
  const referer  = `${origin}/${PANEL_MODE}/MySMSNumbers`;

  try {
    // Mimic the panel's "Select ALL" option — DataTables interprets length=-1 as "all rows".
    // This returns every range/number in a single response (same as the panel's Copy/Download button).
    const res = await fetchDataTables(url, referer, { iDisplayLength: '-1', iColumns: '6' });
    if (res.status !== 200) {
      console.error(`[ims-bot] Numbers HTTP ${res.status}`);
      if (res.status === 401 || res.status === 302) await login();
      return;
    }
    const data = typeof res.body === 'object' ? res.body : JSON.parse(res.body);
    const rows = Array.isArray(data.aaData) ? data.aaData : [];

    // Columns: [Range, Prefix, Number, MyPayterm, MyPayout, Limits]
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
      const country = (rangeName || '').split(/[-_ /|]/)[0].trim() || null;
      items.push({ number: full, range_name: rangeName || null, prefix: prefix || null, country, panel_payout: payout });
    }

    if (items.length === 0) {
      console.log(`[ims-bot] Numbers scrape: 0 rows (panel empty)`);
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
    const uniqueRanges = [...new Set(items.map(i => i.range_name).filter(Boolean))];
    const syncedRanges = await upsertSmsRangesFromItems(items);
    console.log(`[ims-bot] Numbers scrape: ${items.length} parsed, ${inserted} upserted across ${uniqueRanges.length} range(s), ${syncedRanges} sms_ranges synced`);
    if (uniqueRanges.length > 0) console.log(`[ims-bot] Ranges: ${uniqueRanges.slice(0, 20).join(' | ')}${uniqueRanges.length > 20 ? ` (+${uniqueRanges.length - 20} more)` : ''}`);
  } catch (err) {
    console.error(`[ims-bot] Numbers scrape error:`, err.message);
  }
}

// ---------- OTP / SMS CDR ----------
// IMS panel uses Asia/Dhaka (UTC+6). Use Dhaka "today" and widen window to
// include yesterday so OTPs received near midnight Dhaka time are not missed.
function todayRange() {
  const nowDhaka = new Date(Date.now() + 6 * 60 * 60 * 1000); // shift to Dhaka
  const yyyy = nowDhaka.getUTCFullYear();
  const mm = String(nowDhaka.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nowDhaka.getUTCDate()).padStart(2, '0');
  const yesterday = new Date(nowDhaka.getTime() - 24 * 60 * 60 * 1000);
  const yy2 = yesterday.getUTCFullYear();
  const mm2 = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const dd2 = String(yesterday.getUTCDate()).padStart(2, '0');
  return { from: `${yy2}-${mm2}-${dd2} 00:00:00`, to: `${yyyy}-${mm}-${dd} 23:59:59` };
}

async function alreadyLogged(sourceMsgId) {
  try {
    const row = await db.prepare(
      `SELECT 1 FROM otp_audit_log WHERE source = 'ims' AND source_msg_id = ? LIMIT 1`
    ).get(sourceMsgId);
    return !!row;
  } catch (_) { return false; }
}

// Session keep-alive: lightweight ping to keep PHPSESSID fresh, and proactive
// re-login if the session is older than SESSION_MAX_AGE_MS. Combined with
// reactive re-login on 401/302 this keeps OTP auto-sync running 24/7 without
// the admin manually pasting cookies.
async function ensureSession() {
  const now = Date.now();
  const loginUrl = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
  const origin = new URL(loginUrl).origin;

  // Proactive rotation — re-login before IMS forcibly expires us.
  if (lastLoginAt && now - lastLoginAt > SESSION_MAX_AGE_MS) {
    console.log('[ims-bot] Session age > 50min — proactive re-login');
    await login();
    return;
  }

  // Lightweight heartbeat — touches Dashboard so PHPSESSID idle timer resets.
  if (now - lastKeepAlive > KEEP_ALIVE_INTERVAL_MS) {
    lastKeepAlive = now;
    try {
      const r = await client.get(`${origin}/${PANEL_MODE}/Dashboard`, {
        headers: { 'User-Agent': UA }, validateStatus: () => true, maxRedirects: 0,
      });
      const alive = r.status === 200;
      await writeSyncStatus({ session_alive: alive });
      if (!alive) {
        console.log(`[ims-bot] Keep-alive failed (status=${r.status}) — re-logging in`);
        await login();
      }
    } catch (_) {}
  }
}

// Adaptive helper — try multiple column counts (client panel often has 6 cols
// without MyPayout, agent panel has 7) and return the first variant that
// actually has data, so we don't silently log "rows=0" when the only problem
// is a column-count / iSortCol mismatch.
function parseCdrBody(body) {
  try {
    const data = typeof body === 'object' ? body : JSON.parse(String(body));
    const rows = Array.isArray(data.aaData) ? data.aaData : [];
    return { data, rows, ok: true };
  } catch (_) {
    return { data: null, rows: [], ok: false };
  }
}

// CDR fetch with exponential backoff for 503/403/timeout/captcha-load failures.
// Tries iColumns=7 (agent) → 6 (client) → 5 to find the variant the panel accepts.
async function fetchCdrWithRetry(base, referer, origin) {
  const colVariants = PANEL_MODE === 'client' ? ['6', '7', '5'] : ['7', '6', '5'];
  const maxAttempts = 4;
  let lastRes = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const iCols of colVariants) {
      const params = {
        iColumns: iCols, iDisplayLength: '5000', length: '5000',
        iDisplayStart: '0', start: '0', iSortCol_0: '0', sSortDir_0: 'desc',
      };
      try {
        const res = await fetchDataTables(base, referer, params);
        lastRes = res;
        if (res.status === 200) {
          const parsed = parseCdrBody(res.body);
          if (parsed.ok && (parsed.rows.length > 0 || Number(parsed.data?.iTotalRecords || 0) > 0)) {
            return { ok: true, res, retries: attempt, iCols };
          }
          // 200 but empty — try next iColumns variant before backing off
          if (iCols === colVariants[colVariants.length - 1]) {
            // Last variant also empty → return this so caller can log diagnostic
            return { ok: true, res, retries: attempt, iCols, empty: true };
          }
          continue;
        }
        if (res.status === 401 || res.status === 302) {
          console.log(`[ims-bot] CDR ${res.status} — session expired, re-logging in`);
          await writeSyncStatus({ session_alive: false });
          const loggedIn = await login();
          if (!loggedIn) return { ok: false, res, retries: attempt };
          break; // restart attempt loop after fresh login
        }
        if (res.status === 503 || res.status === 403 || res.status === 429) {
          const wait = backoffMs(attempt);
          console.log(`[ims-bot] CDR ${res.status} (attempt ${attempt + 1}/${maxAttempts}, cols=${iCols}) — warm up + backoff ${wait}ms`);
          try {
            await client.get(referer, {
              headers: { 'Referer': `${origin}/${PANEL_MODE}/Dashboard`, 'User-Agent': UA },
              validateStatus: () => true,
            });
          } catch (_) {}
          await sleep(wait);
          break;
        }
        console.log(`[ims-bot] CDR HTTP ${res.status} (cols=${iCols}) — backoff and retry`);
        await sleep(backoffMs(attempt));
        break;
      } catch (err) {
        const wait = backoffMs(attempt);
        console.log(`[ims-bot] CDR fetch error: ${err.message} (attempt ${attempt + 1}/${maxAttempts}, cols=${iCols}) — backoff ${wait}ms`);
        await sleep(wait);
        break;
      }
    }
  }
  return { ok: false, res: lastRes, retries: maxAttempts };
}

async function scrapeSms() {
  if (!isActive || !BOT_ID) return;
  const now = Date.now();
  const elapsed = now - lastSmsScrape;
  if (elapsed < IMS_MIN_INTERVAL_MS) {
    await sleep(IMS_MIN_INTERVAL_MS - elapsed);
  }
  lastSmsScrape = Date.now();

  await ensureSession();

  const loginUrl = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
  const origin   = new URL(loginUrl).origin;
  const { from, to } = todayRange();
  const base = `${origin}/${PANEL_MODE}/res/data_smscdr.php`
    + `?fdate1=${encodeURIComponent(from)}&fdate2=${encodeURIComponent(to)}`
    + `&frange=&fnum=&fcli=&fgdate=&fgmonth=&fgrange=&fgnumber=&fgcli=&fg=0`;
  const referer = `${origin}/${PANEL_MODE}/SMSCDRStats`;

  const startedAt = new Date().toISOString();
  try {
    const { ok, res, retries, iCols } = await fetchCdrWithRetry(base, referer, origin);
    if (!ok) {
      const errMsg = `CDR fetch failed after ${retries} retries (last status=${res?.status ?? 'n/a'})`;
      console.error(`[ims-bot] ${errMsg}`);
      await writeSyncStatus({
        last_sync_at: startedAt, last_error_at: startedAt, last_error: errMsg,
        retry_count: retries, session_alive: res?.status !== 401 && res?.status !== 302,
      });
      return;
    }

    const data = typeof res.body === 'object' ? res.body : JSON.parse(res.body);
    const rows = Array.isArray(data.aaData) ? data.aaData : [];
    await updateBotStatus('online', null);

    const realRows = rows.filter(r => {
      if (!Array.isArray(r) || r.length < 5) return false;
      return /\d{4}-\d{2}-\d{2}/.test(String(r[0] || ''));
    });

    if (rows.length === 0) {
      const sample = typeof res.body === 'string'
        ? res.body.slice(0, 400)
        : JSON.stringify(res.body).slice(0, 400);
      console.log(`[ims-bot] CDR empty — iTotalRecords=${data.iTotalRecords ?? '?'} iTotalDisplayRecords=${data.iTotalDisplayRecords ?? '?'} cols=${typeof iCols !== 'undefined' ? iCols : '?'} window=${from}..${to}`);
      console.log(`[ims-bot] CDR body sample: ${sample}`);
    }

    let billed = 0, dup = 0;
    for (const row of realRows) {
      const dateStr = stripHtml(row[0]);
      const phone   = digitsOnly(stripHtml(row[2]));
      const cli     = stripHtml(row[3]);
      const smsText = stripHtml(row[4]);
      if (!phone || !smsText) continue;

      const textHash = require('crypto').createHash('md5').update(smsText).digest('hex').slice(0, 10);
      const sourceMsgId = `${dateStr}|${phone}|${cli}|${textHash}`;
      if (await alreadyLogged(sourceMsgId)) { dup++; continue; }

      const otpMatch = smsText.match(/\b(\d{3}[- ]?\d{3,4}|\d{4,8})\b/);
      const otpCode  = otpMatch ? otpMatch[1].replace(/[- ]/g, '') : null;

      let userId = null;
      try {
        const owner = await db.prepare(
          `SELECT reserved_for, user_id FROM number_pool WHERE number LIKE ? LIMIT 1`
        ).get(`%${phone.slice(-9)}`);
        userId = owner?.reserved_for || owner?.user_id || null;
      } catch (_) {}

      await logOtpAudit({
        source: 'ims', source_msg_id: sourceMsgId, phone_number: phone, cli,
        otp_code: otpCode, sms_text: smsText, user_id: userId,
        outcome: otpCode ? 'billed' : 'mismatch', amount_bdt: 0,
      });
      if (otpCode) {
        billed++;
        if (userId) {
          try { pushOtpToUser(userId, { phone_number: phone, otp: otpCode, cli, sms_text: smsText }); } catch (_) {}
        }
      }
    }
    console.log(`[ims-bot] CDR scrape: rows=${realRows.length}, billed=${billed}, dup=${dup} (retries=${retries})`);
    await writeSyncStatus({
      last_sync_at: startedAt, last_success_at: startedAt, last_error: null,
      rows_fetched: realRows.length, billed_count: billed, dup_count: dup,
      retry_count: retries, session_alive: true,
    });
    // Increment cumulative counters in a second simple statement (driver-agnostic).
    try {
      await db.prepare(
        `UPDATE bot_sync_status
         SET total_syncs = total_syncs + 1,
             total_billed = total_billed + ?,
             total_dup = total_dup + ?
         WHERE bot_id = ?`
      ).run(billed, dup, BOT_ID);
    } catch (_) {}
  } catch (err) {
    console.error(`[ims-bot] CDR scrape error:`, err.message);
    await writeSyncStatus({
      last_sync_at: startedAt, last_error_at: startedAt, last_error: err.message,
    });
  }
}

// ---------- BOOTSTRAP ----------
async function start() {
  isActive = true;
  console.log('[ims-bot] Bot starting (CLIENT mode)...');

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
    console.log(`[ims-bot] BOT_ID=${BOT_ID}`);
  } catch (err) {
    console.error('[ims-bot] Failed to resolve BOT_ID:', err.message);
    return;
  }

  await resolvePanelMode();

  const ok = await login();
  if (!ok) return;


  // Warm up CDR stats page so the AJAX endpoint accepts us (avoids 503).
  try {
    const loginUrl = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
    const origin = new URL(loginUrl).origin;
    await client.get(`${origin}/${PANEL_MODE}/SMSCDRStats`, { validateStatus: () => true });
    await client.get(`${origin}/${PANEL_MODE}/MySMSNumbers`, { validateStatus: () => true });
    console.log('[ims-bot] Warmed up CDR + Numbers pages');
  } catch (_) {}

  // One-time number pool seed at startup so the admin sees current state.
  // After that, number scraping is ON-DEMAND ONLY — triggered by the admin
  // clicking "Start Auto Pool" (which fires NOTIFY scrape_now). No periodic
  // background number polling.
  scrapeNumbers();

  // OTP/SMS auto-sync stays on a fast loop (IMS-throttled at ~20s/refresh).
  // This is the "Select ALL" CDR copy pushed continuously into otp_audit_log.
  scrapeSms();
  setInterval(scrapeSms, IMS_MIN_INTERVAL_MS);

  // Dedicated session keep-alive ticker — independent of CDR cadence so the
  // PHPSESSID stays warm even if scrapeSms is paused/blocked.
  lastLoginAt = Date.now();
  setInterval(() => { ensureSession().catch(() => {}); }, KEEP_ALIVE_INTERVAL_MS);

  try {
    const { sql } = require('./db');
    await sql.listen('scrape_now', () => {
      console.log('[ims-bot] [auto-pool] NOTIFY scrape_now received');
      scrapeNumbers();
      scrapeSms();
    });
    console.log('[ims-bot] [auto-pool] listening on channel scrape_now');
  } catch (e) {
    console.error('[ims-bot] [auto-pool] LISTEN failed:', e.message);
  }
}


module.exports = { start, stop: () => { isActive = false; } };
