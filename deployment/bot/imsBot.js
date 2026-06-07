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

async function login() {
    const user = await getSetting(BOT_ID, 'username', 'mamun99');
    const pass = await getSetting(BOT_ID, 'password', 'mamun@12aa#');
    const url = await getSetting(BOT_ID, 'portal_url', 'https://www.imssms.org/login');
    
    console.log(`[ims-bot] Attempting login for ${user} at ${url}...`);
    try {
        const res = await client.post(url, new URLSearchParams({
            username: user,
            password: pass
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
            console.log(`[ims-bot] Login successful (status=${res.status}, path=${finalPath})`);
            await db.prepare("UPDATE bots SET status = 'online', last_seen = NOW() WHERE id = ?").run(BOT_ID);
            return true;
        }
        console.error(
            `[ims-bot] Login failed. status=${res.status} path=${finalPath} bodyLen=${body.length} snippet=${body.slice(0, 200).replace(/\s+/g, ' ')}`
        );
        return false;
    } catch (err) {
        console.error(`[ims-bot] Login error:`, err.message);
        return false;
    }
}

async function scrapeSms() {
    const url = 'https://www.imssms.org/agent/sms/logs'; // Simplified path
    try {
        const res = await client.get(url);
        // Scrape logic would go here, looking for table rows
        // For now we'll simulate finding one new message
        console.log(`[ims-bot] Scraped logs, searching for new messages...`);
    } catch (err) {
        console.error(`[ims-bot] Scrape error:`, err.message);
    }
}

async function start() {
    isActive = true;
    console.log('[ims-bot] Bot starting...');
    const ok = await login();
    if (ok) {
        setInterval(scrapeSms, 30000); // Scrape every 30s
    }
}

module.exports = { 
  start,
  stop: () => { isActive = false; } 
};
