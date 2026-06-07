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

async function login() {
    const user = await getSetting(BOT_ID, 'username', 'mamun01');
    const pass = await getSetting(BOT_ID, 'password', 'mamun@12#A');
    const url = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
    
    console.log(`[shark-bot] Attempting login for ${user} at ${url}...`);
    try {
        const loginPage = await client.get(url, { validateStatus: () => true });
        const pageBody = typeof loginPage.data === 'string' ? loginPage.data : '';

        const captchaMatch = pageBody.match(/(\d+)\s*\+\s*(\d+)\s*=/);
        let captchaResult = '0';
        if (captchaMatch) {
            captchaResult = (parseInt(captchaMatch[1]) + parseInt(captchaMatch[2])).toString();
        } else {
            console.warn(`[shark-bot] Captcha pattern not found on login page (status=${loginPage.status}, len=${pageBody.length})`);
        }

        const res = await client.post(url, new URLSearchParams({
            username: user,
            password: pass,
            captcha: captchaResult
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            await db.prepare("UPDATE bots SET status = ?, last_seen = NOW() WHERE name = ?")
                .run('online', BOT_NAME);
            return true;
        }
        console.error(
            `[shark-bot] Login failed. status=${res.status} path=${finalPath} captcha=${captchaResult} bodyLen=${body.length} snippet=${body.slice(0, 200).replace(/\s+/g, ' ')}`
        );
        return false;
    } catch (err) {
        console.error(`[shark-bot] Login error:`, err.message);
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