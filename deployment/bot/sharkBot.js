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
const BOT_ID = 'shark-sms-bot-id'; // To be updated with real ID from DB
const BOT_NAME = 'Shark SMS Bot';

async function login() {
    const user = await getSetting(BOT_ID, 'username', 'mamun01');
    const pass = await getSetting(BOT_ID, 'password', 'mamun@12#A');
    const url = await getSetting(BOT_ID, 'portal_url', 'http://65.109.111.158/ints/login');
    
    console.log(`[shark-bot] Attempting login for ${user}...`);
    try {
        // First get the login page to initialize cookies/captcha
        const loginPage = await client.get(url);
        
        // Simplified captcha solving (Shark SMS uses simple addition)
        // Extract captcha numbers from text using regex: "(\d+) + (\d+) ="
        const captchaMatch = loginPage.data.match(/(\d+)\s*\+\s*(\d+)\s*=/);
        let captchaResult = '0';
        if (captchaMatch) {
            captchaResult = (parseInt(captchaMatch[1]) + parseInt(captchaMatch[2])).toString();
        }

        const res = await client.post(url, new URLSearchParams({
            username: user,
            password: pass,
            captcha: captchaResult
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        if (res.data.includes('Logout') || res.status === 302 || res.request.path.includes('dashboard')) {
            console.log(`[shark-bot] Login successful`);
            // Store cookies for fast re-login (implemented via axios-cookiejar-support)
            await db.prepare('UPDATE bots SET status = ?, last_seen = NOW() WHERE name = ?')
                .run('online', BOT_NAME);
            return true;
        }
        console.error(`[shark-bot] Login failed: Unexpected response`);
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
        // Parsing table logic: find table rows in res.data
        // We look for Date, Range, Number, CLI, Message/OTP
        console.log(`[shark-bot] Scraped logs, searching for new messages...`);
        
        // Mock implementation of delivery to user
        /*
        const newMessages = parseTable(res.data);
        for (const msg of newMessages) {
            const allocation = await findMatchingAllocation({
                provider: 'shark',
                phone: msg.number
            });
            
            if (allocation) {
                await logOtpAudit({
                    source: 'shark',
                    phone_number: msg.number,
                    otp_code: msg.otp,
                    sms_text: msg.full_text,
                    user_id: allocation.user_id,
                    outcome: 'billed'
                });
                console.log(`[shark-bot] Delivered OTP for ${msg.number} to user ${allocation.user_id}`);
            }
        }
        */
    } catch (err) {
        console.error(`[shark-bot] Scrape error:`, err.message);
        // Auto re-login if session expired
        if (err.response && err.response.status === 401) {
            await login();
        }
    }
}

async function start() {
    isActive = true;
    console.log('[shark-bot] Bot starting...');
    
    // Check if we need to insert bot into DB
    const existing = await db.prepare('SELECT id FROM bots WHERE name = ?').get(BOT_NAME);
    if (!existing) {
        await db.prepare('INSERT INTO bots (id, name, bot_type, status) VALUES (?, ?, ?, ?)')
            .run(crypto.randomUUID(), BOT_NAME, 'shark', 'offline');
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