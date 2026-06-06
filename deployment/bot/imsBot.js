// imsBot.js
const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const db = require('./db');
const { markOtpReceived } = require('./router_mock');
const { logOtpAudit } = require('./otpAudit');
const { findMatchingAllocation, hasSeenSourceMessage } = require('./allocationMatcher');
const { Telemetry } = require('./_botTelemetry');
const { getSetting } = require('./settings');

const tel = new Telemetry();
const BOT_ID = '36fae619-2d83-4416-b243-8f7af4c33100';

const log = (...a) => console.log('[ims-bot]', ...a);
const warn = (...a) => console.warn('[ims-bot]', ...a);

let _client = null, _jar = null, _sesskey = null;
let _loggedIn = false, _running = false, _stopFlag = false;
let _lastTickAt = null, _lastError = null;

async function resolveCfg() {
  const username = await getSetting(BOT_ID, 'username', process.env.IMS_USERNAME);
  const password = await getSetting(BOT_ID, 'password', process.env.IMS_PASSWORD);
  const portalUrl = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
  const interval = parseInt(await getSetting(BOT_ID, 'interval', '15'), 10);

  return {
    ENABLED: true,
    BASE_URL: portalUrl.replace(/\/login$/, ''),
    USERNAME: username,
    PASSWORD: password,
    INTERVAL: interval
  };
}

function solveCaptcha(html) {
  const m = html.match(/What\s+is\s+(\d+)\s*([+\-x*\/])\s*(\d+)/i);
  if (!m) return null;
  const a = +m[1], b = +m[3], op = m[2].toLowerCase();
  if (op === '+') return String(a + b);
  if (op === '-') return String(a - b);
  if (op === '*' || op === 'x') return String(a * b);
  if (op === '/') return String(Math.floor(a / b));
  return null;
}

async function login() {
  const cfg = await resolveCfg();
  if (!cfg.USERNAME || !cfg.PASSWORD) throw new Error('Missing credentials');

  _jar = new tough.CookieJar();
  _client = wrapper(axios.create({
    baseURL: cfg.BASE_URL,
    jar: _jar,
    withCredentials: true,
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }));

  log('Logging in...');
  const r1 = await _client.get('/login');
  const captAns = solveCaptcha(r1.data);
  const etkk = r1.data.match(/name=['"]etkk['"]\s+value=['"]([^'"]+)['"]/)?.[1];

  const form = new URLSearchParams();
  if (etkk) form.set('etkk', etkk);
  form.set('username', cfg.USERNAME);
  form.set('password', cfg.PASSWORD);
  if (captAns) form.set('capt', captAns);

  const r2 = await _client.post('/signin', form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const probe = await _client.get('/client/SMSCDRStats');
  const m = probe.data.match(/data_smscdr\.php\?[^'"]*sesskey=([^&'"\s]+)/);
  if (m) {
    _sesskey = m[1];
    _loggedIn = true;
    log('Login successful');
    return true;
  }
  throw new Error('Failed to obtain sesskey');
}

async function tickOnce() {
  if (!_loggedIn) await login();
  const cfg = await resolveCfg();

  const params = new URLSearchParams({
    sesskey: _sesskey,
    iColumns: '7',
    iDisplayLength: '100',
    sEcho: String(Date.now())
  });

  const r = await _client.get(`/client/res/data_smscdr.php?${params.toString()}`);
  const rows = r.data?.aaData || [];
  log(`Fetched ${rows.length} rows`);

  for (const row of rows) {
    const phone = String(row[2] || '').replace(/\D/g, '');
    const msg = String(row[4] || '');
    const otpMatch = msg.match(/\b(\d{4,8})\b/);
    if (!otpMatch) continue;

    const otp = otpMatch[1];
    const dedup = `${row[0]}|${phone}|${msg.slice(0, 50)}`;

    if (await hasSeenSourceMessage('ims', dedup)) continue;

    const alloc = await findMatchingAllocation({ provider: 'ims', phone });
    if (alloc) {
      try {
        await markOtpReceived(alloc, otp, row[3], msg, { source: 'ims', source_msg_id: dedup });
        log(`Delivered OTP ${otp} for ${phone}`);
      } catch (e) {
        warn(`Failed to deliver OTP: ${e.message}`);
      }
    }
  }
}

async function loop() {
  _running = true;
  while (!_stopFlag) {
    try {
      await tickOnce();
      await db.prepare("UPDATE bots SET last_seen = NOW(), status = 'online' WHERE id = ?").run(BOT_ID);
    } catch (e) {
      warn('Loop error:', e.message);
      _loggedIn = false;
      await db.prepare("UPDATE bots SET last_error = ? WHERE id = ?").run(e.message, BOT_ID);
    }
    const cfg = await resolveCfg();
    await new Promise(r => setTimeout(r, cfg.INTERVAL * 1000));
  }
  _running = false;
}

function start() {
  if (_running) return;
  _stopFlag = false;
  loop().catch(e => warn('Fatal:', e.message));
}

function stop() {
  _stopFlag = true;
}

module.exports = { start, stop };
