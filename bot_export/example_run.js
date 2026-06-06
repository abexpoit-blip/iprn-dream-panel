/**
 * Nexus X V 2.0 - Bot Module Standalone Export
 * -------------------------------------------
 * This bundle contains the SMS Hadi and IMS bot scrapers.
 * 
 * SETUP:
 * 1. Ensure you have Node.js 18+ installed.
 * 2. Run 'npm install' to install dependencies (axios, tough-cookie, better-sqlite3).
 * 3. Initialize your database using the provided schema.sql.
 * 4. Run the bots using the example code below.
 */

const smshadi = require('./workers/smshadiBot');
const ims = require('./workers/imsBot');
const ims2 = require('./workers/imsBot2');

console.log("🚀 Starting Standalone Bot Module...");

// Configuration is read from the 'settings' table in the database.
// Ensure your 'settings' table has correct credentials for smshadi and ims.

try {
  smshadi.start();
  console.log("✅ SMS Hadi Bot initialized");
} catch (e) {
  console.error("❌ SMS Hadi Bot failed to start:", e.message);
}

try {
  ims.start();
  console.log("✅ IMS Bot initialized");
} catch (e) {
  console.error("❌ IMS Bot failed to start:", e.message);
}

try {
  ims2.start();
  console.log("✅ IMS Bot 2 initialized");
} catch (e) {
  console.error("❌ IMS Bot 2 failed to start:", e.message);
}

console.log("📡 Bots are now polling panels for OTPs...");
