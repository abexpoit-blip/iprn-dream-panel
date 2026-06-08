const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { getSetting } = require('./settings');
const { logOtpAudit } = require('./otpAudit');
const { findMatchingAllocation, hasSeenSourceMessage } = require('./allocationMatcher');
const db = require('./db');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

let isActive = false;
const BOT_ID = '36fae619-2d83-4416-b243-8f7af4c33100';

async function updateBotStatus(status, error = null) {
    try {
        await db.prepare("UPDATE bots SET status = ?, last_seen = NOW(), last_error = ? WHERE id = ?")
            .run(status, error, BOT_ID);
    } catch (e) { /* ignore */ }
}

function extractCsrfToken(html) {
    // Laravel-style: <input ... name="_token" value="...">
    let m = html.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/i);
    if (m) return { name: '_token', value: m[1] };
    m = html.match(/value=["']([^"']+)["'][^>]*name=["']_token["']/i);
    if (m) return { name: '_token', value: m[1] };
    // Meta tag fallback
    m = html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i);
    if (m) return { name: '_token', value: m[1] };
    return null;
}

async function login() {
    const user = await getSetting(BOT_ID, 'username', 'mamun99');
    const pass = await getSetting(BOT_ID, 'password', 'mamun@12aa#');
    const url = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');

    console.log(`[ims-bot] Attempting login for ${user} at ${url}...`);
    try {
        // Step 1: GET login page to capture CSRF token + cookies
        const pageRes = await client.get(url, { validateStatus: () => true });
        const pageHtml = typeof pageRes.data === 'string' ? pageRes.data : '';
        const csrf = extractCsrfToken(pageHtml);

        if (!csrf) {
            const reason = `CSRF _token not found on login page (status=${pageRes.status}, len=${pageHtml.length})`;
            console.error(`[ims-bot] ${reason}`);
            await updateBotStatus('offline', reason);
            return false;
        }
        console.log(`[ims-bot] Got CSRF token (len=${csrf.value.length})`);

        // Step 2: POST credentials with token
        const form = new URLSearchParams({
            [csrf.name]: csrf.value,
            username: user,
            password: pass,
        });
        const res = await client.post(url, form, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': url,
                'Origin': new URL(url).origin,
            },
            maxRedirects: 5,
            validateStatus: () => true,
        });

        const body = typeof res.data === 'string' ? res.data : '';
        const finalPath = res.request?.path || '';
        const success =
            body.includes('Logout') ||
            body.includes('logout') ||
            body.includes('Dashboard') ||
            finalPath.includes('dashboard') ||
            finalPath.includes('agent');

        if (success) {
            console.log(`[ims-bot] Login successful (status=${res.status}, path=${finalPath})`);
            await updateBotStatus('online', null);
            return true;
        }
        const reason = `Login rejected (status=${res.status}, path=${finalPath}). Check credentials.`;
        console.error(`[ims-bot] ${reason} snippet=${body.slice(0, 200).replace(/\s+/g, ' ')}`);
        await updateBotStatus('offline', reason);
        return false;
    } catch (err) {
        console.error(`[ims-bot] Login error:`, err.message);
        await updateBotStatus('offline', `Network error: ${err.message}`);
        return false;
    }
}

let lastScrapeTime = 0;
const IMS_MIN_INTERVAL_MS = 20000; // 20s — IMS blocks if refresh < 15s

async function scrapeSms() {
    const now = Date.now();
    const elapsed = now - lastScrapeTime;
    if (elapsed < IMS_MIN_INTERVAL_MS) {
        const wait = IMS_MIN_INTERVAL_MS - elapsed;
        console.log(`[ims-bot] Rate-limit guard: waiting ${wait}ms before scrape`);
        await new Promise(r => setTimeout(r, wait));
    }
    lastScrapeTime = Date.now();

    const url = 'https://www.imssms.org/agent/sms/logs';
    try {
        const res = await client.get(url);
        console.log(`[ims-bot] Scraped logs (status=${res.status}), searching for new messages...`);
    } catch (err) {
        console.error(`[ims-bot] Scrape error:`, err.message);
    }
}

async function start() {
    isActive = true;
    console.log('[ims-bot] Bot starting...');
    const ok = await login();
    if (ok) {
        // Honor IMS rate limit — never below 16s. Default 20s.
        setInterval(scrapeSms, IMS_MIN_INTERVAL_MS);
    }
}

module.exports = { 
  start,
  stop: () => { isActive = false; } 
};
