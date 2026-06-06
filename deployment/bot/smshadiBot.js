// smshadiBot.js
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
const BOT_ID = '95280089-8b3e-4c88-9e49-be5fe93330a9';

const log = (...a) => console.log('[smshadi-bot]', ...a);
const warn = (...a) => console.warn('[smshadi-bot]', ...a);

let _client = null, _jar = null, _sesskey = null;
let _loggedIn = false, _running = false, _stopFlag = false;

async function resolveCfg() {
  const username = await getSetting(BOT_ID, 'username', 'mamun999');
  const password = await getSetting(BOT_ID, 'password', 'mamun999');
  const portalUrl = await getSetting(BOT_ID, 'portal_url', 'http://2.59.169.96/ints');
  const interval = parseInt(await getSetting(BOT_ID, 'interval', '60'), 10);

  return {
    ENABLED: true,
    BASE_URL: portalUrl,
    USERNAME: username,
    PASSWORD: password,
    INTERVAL: interval
  };
}

async function login() {
  const cfg = await resolveCfg();
  _jar = new tough.CookieJar();
  _client = wrapper(axios.create({
    baseURL: cfg.BASE_URL,
    jar: _jar,
    withCredentials: true,
    timeout: 20000
  }));

  log('Logging in...');
  // Simple login mock for Hadi - real implementation would scrape tokens
  await _client.get('/agent/login');
  _loggedIn = true;
  return true;
}

async function tickOnce() {
  if (!_loggedIn) await login();
  log('Checking for new SMS...');
  // Scraper logic here
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
