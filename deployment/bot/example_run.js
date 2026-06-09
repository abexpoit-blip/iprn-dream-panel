// example_run.js
const imsBot = require('./imsBot');
const sharkBot = require('./sharkBot');
const smshadiBot = require('./smshadiBot');

async function run() {
  console.log('🤖 Nexus Bots service initializing...');

  // Start bots in parallel. All three (IMS, Shark, SMS Hadi) use CLIENT-panel
  // endpoints by default (override per-bot via bot_settings.panel_mode).
  await Promise.all([
    imsBot.start(),
    sharkBot.start(),
    smshadiBot.start(),
  ]);

  console.log('✓ All active bots started.');

  // Keep the process alive
  setInterval(() => {
    console.log('Heartbeat: Bot service is active');
  }, 1000 * 60 * 10);
}

run().catch(err => {
  console.error('Fatal error in bot runner:', err);
  process.exit(1);
});
