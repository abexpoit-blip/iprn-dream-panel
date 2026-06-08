const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { getSetting } = require('./settings');
const { logOtpAudit } = require('./otpAudit');
const { findMatchingAllocation } = require('./allocationMatcher');
const { scrapePanelNumbers } = require('./numberScraper');
const db = require('./db');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

let isActive = false;
let BOT_ID = null; // Resolved from DB at start()
const BOT_NAME = 'Shark SMS Bot';
const BOT_TYPE = 'shark';

async function updateBotStatus(status, error = null) {
    if (!BOT_ID) return;
    try {
        await db.prepare("UPDATE bots SET status = ?, last_seen = NOW(), last_error = ? WHERE id = ?")
            .run(status, error, BOT_ID);
    } catch (e) { /* ignore */ }
}

function parseCookieString(cookieStr, urlOrigin) {
    // Accepts "key1=val1; key2=val2" — injects each into jar
    if (!cookieStr) return 0;
    const parts = cookieStr.split(';').map(s => s.trim()).filter(Boolean);
    let count = 0;
    for (const part of parts) {
        try {
            jar.setCookieSync(part, urlOrigin);
            count++;
        } catch (_) { /* ignore bad cookie */ }
    }
    return count;
}

function getAttr(tag, name) {
    const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
    return m ? m[1] : '';
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

    const captchaField = inputTags.map(input => getAttr(input, 'name')).find(name => ['capt', 'captcha'].includes(name)) || 'capt';
    const mathMatch = formHtml.match(/(?:what\s+is\s*)?(\d+)\s*\+\s*(\d+)\s*=\s*\?/i) || html.match(/(?:what\s+is\s*)?(\d+)\s*\+\s*(\d+)\s*=\s*\?/i);
    const hasImageCaptcha = /<img[^>]+captcha/i.test(formHtml) || /captcha\.(png|jpg|jpeg|gif|svg)/i.test(formHtml);

    return { postUrl, fields, captchaField, mathMatch, hasImageCaptcha };
}

async function login() {
    const user = await getSetting(BOT_ID, 'username', 'mamun01');
    const pass = await getSetting(BOT_ID, 'password', 'mamun@12#A');
    const url = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
    const sessionCookie = await getSetting(BOT_ID, 'session_cookie', '');
    const manualCaptcha = await getSetting(BOT_ID, 'captcha_token', '');

    const origin = new URL(url).origin;

    // OPTION A — User pasted a valid session cookie: skip login entirely
    if (sessionCookie && sessionCookie.trim().length > 5) {
        const n = parseCookieString(sessionCookie.trim(), origin);
        console.log(`[shark-bot] Using pasted session cookie (${n} entries) — skipping login form`);
        // Verify session by hitting a protected page
        try {
            const check = await client.get(`${origin}/ints/agent`, { validateStatus: () => true, maxRedirects: 0 });
            if (check.status === 200) {
                console.log(`[shark-bot] Session cookie verified — logged in via paste`);
                await updateBotStatus('online', null);
                return true;
            }
            const reason = `Pasted session cookie rejected (status=${check.status}). Paste a fresh cookie.`;
            console.error(`[shark-bot] ${reason}`);
            await updateBotStatus('offline', reason);
            return false;
        } catch (e) {
            await updateBotStatus('offline', `Cookie verify failed: ${e.message}`);
            return false;
        }
    }

    console.log(`[shark-bot] Attempting login for ${user} at ${url}...`);
    try {
        const loginPage = await client.get(url, { validateStatus: () => true });
        const pageBody = typeof loginPage.data === 'string' ? loginPage.data : '';
        const loginForm = extractLoginFormDetails(pageBody, url);

        // Detect captcha presence
        let captchaResult = '';
        if (manualCaptcha && manualCaptcha.trim()) {
            captchaResult = manualCaptcha.trim();
            console.log(`[shark-bot] Using manual captcha token from settings: "${captchaResult}"`);
        } else if (loginForm.mathMatch) {
            captchaResult = (parseInt(loginForm.mathMatch[1], 10) + parseInt(loginForm.mathMatch[2], 10)).toString();
            console.log(`[shark-bot] Solved math captcha: ${loginForm.mathMatch[1]}+${loginForm.mathMatch[2]}=${captchaResult}`);
        } else if (loginForm.hasImageCaptcha) {
            const reason = 'Image captcha detected — paste session_cookie or captcha_token in Login Info';
            console.error(`[shark-bot] ${reason}`);
            await updateBotStatus('offline', reason);
            return false;
        }

        const payload = new URLSearchParams({
            ...loginForm.fields,
            username: user,
            password: pass,
        });
        if (captchaResult) payload.set(loginForm.captchaField, captchaResult);

        const res = await client.post(loginForm.postUrl, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': url, 'Origin': origin },
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
            console.log(`[shark-bot] Login successful (status=${res.status}, path=${finalPath})`);
            await updateBotStatus('online', null);
            return true;
        }
        const reason = `Login rejected (status=${res.status}, path=${finalPath}). Captcha/session may be wrong — paste session_cookie instead.`;
        console.error(`[shark-bot] ${reason} captcha=${captchaResult} post=${loginForm.postUrl} bodyLen=${body.length}`);
        await updateBotStatus('offline', reason);
        return false;
    } catch (err) {
        console.error(`[shark-bot] Login error:`, err.message);
        await updateBotStatus('offline', `Network error: ${err.message}`);
        return false;
    }
}

async function scrapeSms() {
    if (!isActive) return;

    // Derive CDR URL from login URL: replace /login → /agent/SMSCDRStats
    const loginUrl = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
    const defaultCdr = loginUrl.replace(/\/login\/?$/, '/agent/SMSCDRStats');
    const url = await getSetting(BOT_ID, 'cdr_url', defaultCdr);
    const referer = loginUrl.replace(/\/login\/?$/, '/agent/SMSDashboard');

    try {
        const res = await client.get(url, { validateStatus: () => true, headers: { 'Referer': referer } });
        if (res.status !== 200) {
            const reason = `Scrape HTTP ${res.status} at ${url}`;
            console.error(`[shark-bot] ${reason}`);
            await updateBotStatus('error', reason);
            if (res.status === 401 || res.status === 302) await login();
            return;
        }
        const body = typeof res.data === 'string' ? res.data : '';
        console.log(`[shark-bot] Scraped logs OK (len=${body.length}) from ${url}`);
        await updateBotStatus('online', null);

        const rowRegex = /<tr>\s*<td>([\d-: ]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>(\+?\d+)<\/td>\s*<td>([^<]*)<\/td>[\s\S]*?<td>([^<]*)<\/td>/gi;
        let match;
        while ((match = rowRegex.exec(body)) !== null) {
            const [_, dateStr, range, phone, cli, fullText] = match;
            const sourceMsgId = `${dateStr}_${phone}_${cli}`.replace(/\s+/g, '');
            if (await hasSeenSourceMessage('shark', sourceMsgId)) continue;
            const allocation = await findMatchingAllocation({ provider: 'shark', phone, panelRange: range });
            if (!allocation) {
                console.log(`[shark-bot] [SAFEGUARD] Unassociated message for ${phone} (Range: ${range}). Skipping.`);
                continue;
            }
            const otpMatch = fullText.match(/\b(\d{4,8})\b/);
            const otpCode = otpMatch ? otpMatch[1] : null;
            await logOtpAudit({
                source: 'shark', source_msg_id: sourceMsgId, phone_number: phone, cli,
                otp_code: otpCode, sms_text: fullText, user_id: allocation.user_id,
                outcome: otpCode ? 'billed' : 'mismatch', amount_bdt: 0,
            });
            console.log(`[shark-bot] [DELIVERED] ${phone} -> User ${allocation.user_id} | OTP: ${otpCode || 'None'}`);
        }
    } catch (err) {
        console.error(`[shark-bot] Scrape error:`, err.message);
        await updateBotStatus('error', `Scrape error: ${err.message}`);
    }
}

// Scrape panel's DID/number list and upsert into number_pool
async function scrapeNumbers() {
    if (!isActive || !BOT_ID) return;
    const loginUrl = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
    const origin = new URL(loginUrl).origin;
    const defaultNumbersUrl = `${origin}/ints/agent/MyNumbers`;
    const url = await getSetting(BOT_ID, 'numbers_url', defaultNumbersUrl);
    const referer = loginUrl.replace(/\/login\/?$/, '/agent/SMSDashboard');

    try {
        const result = await scrapePanelNumbers({ client, url, referer });
        if (result.status !== 200) {
            console.error(`[shark-bot] Numbers scrape HTTP ${result.status} at ${url}`);
            if (result.status === 401 || result.status === 302) await login();
            return;
        }
        const seen = result.numbers;
        if (seen.size === 0) {
            console.log(`[shark-bot] Numbers scrape: 0 phones parsed from ${url} (len=${result.bodyLength}). AJAX attempts: ${result.attempts.join(' | ') || 'none'}`);
            return;
        }
        let inserted = 0;
        for (const number of seen) {
            try {
                const r = await db.prepare(
                    `INSERT INTO number_pool (number, status, bot_id) VALUES (?, 'available', ?) ON CONFLICT (number) DO UPDATE SET bot_id = EXCLUDED.bot_id, updated_at = NOW() RETURNING number`
                ).run(number, BOT_ID);
                if (r.changes) inserted++;
            } catch (e) { /* ignore per-row */ }
        }
        console.log(`[shark-bot] Numbers scrape: ${seen.size} parsed from ${result.sourceUrl}, ${inserted} upserted into number_pool`);
    } catch (err) {
        console.error(`[shark-bot] Numbers scrape error:`, err.message);
    }
}


async function start() {
    isActive = true;
    console.log('[shark-bot] Bot starting...');

    // Resolve BOT_ID from DB (lookup by bot_type, insert if missing)
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
    } catch (err) {
        console.error('[shark-bot] Failed to resolve BOT_ID:', err.message);
        return;
    }

    const ok = await login();
    if (ok) {
        setInterval(scrapeSms, 15000); // Fast scraping for Shark SMS (15s)
        scrapeNumbers();
        setInterval(scrapeNumbers, 60000); // Refresh number_pool every 60s

        // Listen for on-demand auto-pool trigger from the panel UI
        try {
            const { sql } = require('./db');
            await sql.listen('scrape_now', () => {
                console.log('[shark-bot] [auto-pool] NOTIFY scrape_now received — running scrapeNumbers()');
                scrapeNumbers();
            });
            console.log('[shark-bot] [auto-pool] listening on channel scrape_now');
        } catch (e) {
            console.error('[shark-bot] [auto-pool] LISTEN failed:', e.message);
        }
    }
}

module.exports = { 
  start,
  stop: () => { isActive = false; } 
};