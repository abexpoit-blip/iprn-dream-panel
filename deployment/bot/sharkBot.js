const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { getSetting } = require('./settings');
const { logOtpAudit } = require('./otpAudit');
const { findMatchingAllocation } = require('./allocationMatcher');
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

        // Detect captcha presence
        const hasCaptchaImg = /<img[^>]+captcha/i.test(pageBody) || /name=["']captcha["']/i.test(pageBody);
        const mathMatch = pageBody.match(/(\d+)\s*\+\s*(\d+)\s*=/);

        let captchaResult = '';
        if (manualCaptcha && manualCaptcha.trim()) {
            captchaResult = manualCaptcha.trim();
            console.log(`[shark-bot] Using manual captcha token from settings: "${captchaResult}"`);
        } else if (mathMatch) {
            captchaResult = (parseInt(mathMatch[1]) + parseInt(mathMatch[2])).toString();
            console.log(`[shark-bot] Solved math captcha: ${mathMatch[1]}+${mathMatch[2]}=${captchaResult}`);
        } else if (hasCaptchaImg) {
            const reason = 'Image captcha detected — paste session_cookie or captcha_token in Login Info';
            console.error(`[shark-bot] ${reason}`);
            await updateBotStatus('offline', reason);
            return false;
        }

        const res = await client.post(url, new URLSearchParams({
            username: user,
            password: pass,
            captcha: captchaResult
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': url },
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
        const reason = `Login rejected (status=${res.status}). Captcha may be wrong — paste session_cookie instead.`;
        console.error(`[shark-bot] ${reason} captcha=${captchaResult} bodyLen=${body.length}`);
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
    
    const url = 'http://65.109.111.158/agent/sms/cdr'; // Detailed SMS Logs
    try {
        const res = await client.get(url);
        console.log(`[shark-bot] Scraped logs, searching for new messages...`);
        
        // Use regex to find table rows with data (Date, Range, Number, CLI, Message/OTP)
        // Format: <td>2026-06-07 15:12:27</td>...<td>Number</td><td>CLI</td><td>Message</td>
        const rowRegex = /<tr>\s*<td>([\d-: ]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>(\+?\d+)<\/td>\s*<td>([^<]*)<\/td>[\s\S]*?<td>([^<]*)<\/td>/gi;
        let match;
        
        while ((match = rowRegex.exec(res.data)) !== null) {
            const [_, dateStr, range, phone, cli, fullText] = match;
            const sourceMsgId = `${dateStr}_${phone}_${cli}`.replace(/\s+/g, '');
            
            // 1. Seen Check
            if (await hasSeenSourceMessage('shark', sourceMsgId)) continue;

            // 2. Association Safeguard (Find user who owns this number)
            const allocation = await findMatchingAllocation({
                provider: 'shark',
                phone: phone,
                panelRange: range
            });
            
            if (!allocation) {
                console.log(`[shark-bot] [SAFEGUARD] Unassociated message for ${phone} (Range: ${range}). Skipping.`);
                continue;
            }

            // 3. OTP Extraction
            const otpMatch = fullText.match(/\b(\d{4,8})\b/);
            const otpCode = otpMatch ? otpMatch[1] : null;

            // 4. Delivery Validation
            await logOtpAudit({
                source: 'shark',
                source_msg_id: sourceMsgId,
                phone_number: phone,
                cli: cli,
                otp_code: otpCode,
                sms_text: fullText,
                user_id: allocation.user_id,
                outcome: otpCode ? 'billed' : 'mismatch',
                amount_bdt: 0 // Will be calculated by system later
            });

            console.log(`[shark-bot] [DELIVERED] ${phone} -> User ${allocation.user_id} | OTP: ${otpCode || 'None'}`);
        }
    } catch (err) {
        console.error(`[shark-bot] Scrape error:`, err.message);
        // Auto re-login if session expired
        if (err.response && (err.response.status === 401 || err.response.status === 302)) {
            await login();
        }
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
    }
}

module.exports = { 
  start,
  stop: () => { isActive = false; } 
};