const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { getSetting } = require('./settings');
const { logOtpAudit } = require('./otpAudit');
const { findMatchingAllocation, hasSeenSourceMessage } = require('./allocationMatcher');
const { scrapePanelNumbers } = require('./numberScraper');
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

function getAttr(tag, name) {
    const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
    return m ? m[1] : '';
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

function extractLoginFormDetails(html, pageUrl) {
    const formHtml = (html.match(/<form[\s\S]*?<\/form>/i) || [html])[0];
    const formOpen = (formHtml.match(/<form[^>]*>/i) || [''])[0];
    const action = getAttr(formOpen, 'action') || pageUrl;
    const postUrl = new URL(action, pageUrl).toString();
    const fields = {};
    const inputTags = formHtml.match(/<input\b[^>]*>/gi) || [];

    for (const input of inputTags) {
        const name = getAttr(input, 'name');
        if (!name) continue;
        const type = (getAttr(input, 'type') || '').toLowerCase();
        if (type === 'hidden') fields[name] = getAttr(input, 'value');
    }

    const csrf = fields._token || fields.csrf_token || fields.csrf || fields.etkk || '';
    const captchaMatch = formHtml.match(/(?:what\s+is\s*)?(\d+)\s*\+\s*(\d+)\s*=\s*\?/i) || html.match(/(?:what\s+is\s*)?(\d+)\s*\+\s*(\d+)\s*=\s*\?/i);
    const captchaField = inputTags.map(input => getAttr(input, 'name')).find(name => ['capt', 'captcha'].includes(name));
    if (captchaField && captchaMatch) fields[captchaField] = String(parseInt(captchaMatch[1], 10) + parseInt(captchaMatch[2], 10));

    return { postUrl, fields, csrf };
}

async function login() {
    const user = await getSetting(BOT_ID, 'username', 'mamun99');
    const pass = await getSetting(BOT_ID, 'password', 'mamun@12aa#');
    const url = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
    const sessionCookie = await getSetting(BOT_ID, 'session_cookie', '');
    const origin = new URL(url).origin;

    // OPTION A — User pasted a valid session cookie: skip login form
    if (sessionCookie && sessionCookie.trim().length > 5) {
        const n = parseCookieString(sessionCookie.trim(), origin);
        console.log(`[ims-bot] Using pasted session cookie (${n} entries) — skipping login form`);
        try {
            const check = await client.get(`${origin}/agent/SMSDashboard`, { validateStatus: () => true, maxRedirects: 0 });
            if (check.status === 200) {
                console.log(`[ims-bot] Session cookie verified — logged in via paste`);
                await updateBotStatus('online', null);
                return true;
            }
            const reason = `Pasted session cookie rejected (status=${check.status}). Paste a fresh cookie.`;
            console.error(`[ims-bot] ${reason}`);
            await updateBotStatus('offline', reason);
            return false;
        } catch (e) {
            await updateBotStatus('offline', `Cookie verify failed: ${e.message}`);
            return false;
        }
    }

    console.log(`[ims-bot] Attempting login for ${user} at ${url}...`);
    try {
        // Step 1: GET login page to capture hidden login token/cookies/captcha
        const pageRes = await client.get(url, { validateStatus: () => true });
        const pageHtml = typeof pageRes.data === 'string' ? pageRes.data : '';
        const loginForm = extractLoginFormDetails(pageHtml, url);

        if (!loginForm.csrf) {
            const reason = `Login token not found on IMS page (status=${pageRes.status}, len=${pageHtml.length})`;
            console.error(`[ims-bot] ${reason}`);
            await updateBotStatus('offline', reason);
            return false;
        }
        console.log(`[ims-bot] Got login token (len=${loginForm.csrf.length}) and posting to ${loginForm.postUrl}`);

        // Step 2: POST credentials with token
        const form = new URLSearchParams({
            ...loginForm.fields,
            username: user,
            password: pass,
        });
        const res = await client.post(loginForm.postUrl, form, {
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

    // Derive CDR URL from login URL: replace /login with /agent/SMSCDRStats
    const loginUrl = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
    const defaultCdr = loginUrl.replace(/\/login\/?$/, '/agent/SMSCDRStats');
    const url = await getSetting(BOT_ID, 'cdr_url', defaultCdr);

    try {
        const res = await client.get(url, { validateStatus: () => true, headers: { 'Referer': loginUrl.replace(/\/login\/?$/, '/agent/SMSDashboard') } });
        if (res.status !== 200) {
            const reason = `Scrape HTTP ${res.status} at ${url}`;
            console.error(`[ims-bot] ${reason}`);
            await updateBotStatus('error', reason);
            if (res.status === 401 || res.status === 302) await login();
            return;
        }
        console.log(`[ims-bot] Scraped logs OK (len=${(res.data||'').length}) from ${url}`);
        await updateBotStatus('online', null);
    } catch (err) {
        console.error(`[ims-bot] Scrape error:`, err.message);
        await updateBotStatus('error', `Scrape error: ${err.message}`);
    }
}

// Scrape the panel's DID/number list and upsert into number_pool
async function scrapeNumbers() {
    const loginUrl = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
    const origin = new URL(loginUrl).origin;
    const defaultNumbersUrl = `${origin}/agent/MyNumbers`;
    const url = await getSetting(BOT_ID, 'numbers_url', defaultNumbersUrl);
    const referer = loginUrl.replace(/\/login\/?$/, '/agent/SMSDashboard');

    try {
        const result = await scrapePanelNumbers({ client, url, referer });
        if (result.status !== 200) {
            console.error(`[ims-bot] Numbers scrape HTTP ${result.status} at ${url}`);
            if (result.status === 401 || result.status === 302) await login();
            return;
        }
        const seen = result.numbers;
        if (seen.size === 0) {
            console.log(`[ims-bot] Numbers scrape: 0 phones parsed from ${url} (len=${result.bodyLength}). AJAX attempts: ${result.attempts.join(' | ') || 'none'}`);
            return;
        }
        let inserted = 0;
        for (const number of seen) {
            try {
                const r = await db.prepare(
                    `INSERT INTO number_pool (number, status, bot_id) VALUES (?, 'available', ?) ON CONFLICT (number) DO UPDATE SET bot_id = EXCLUDED.bot_id, updated_at = NOW()`
                ).run(number, BOT_ID);
                if (r.changes) inserted++;
            } catch (e) { /* ignore per-row */ }
        }
        console.log(`[ims-bot] Numbers scrape: ${seen.size} parsed from ${result.sourceUrl}, ${inserted} upserted into number_pool`);
    } catch (err) {
        console.error(`[ims-bot] Numbers scrape error:`, err.message);
    }
}


async function start() {
    isActive = true;
    console.log('[ims-bot] Bot starting...');
    const ok = await login();
    if (ok) {
        // Honor IMS rate limit — never below 16s. Default 20s.
        setInterval(scrapeSms, IMS_MIN_INTERVAL_MS);
        // Refresh number pool every 60s
        scrapeNumbers();
        setInterval(scrapeNumbers, 60000);
    }
}

module.exports = { 
  start,
  stop: () => { isActive = false; } 
};
