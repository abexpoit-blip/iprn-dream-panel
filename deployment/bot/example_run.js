// example_run.js
const imsBot = require('./imsBot');
const imsBot2 = require('./imsBot2');
const smshadiBot = require('./smshadiBot');

async function run() {
  console.log('🤖 Nexus Bots service is in PASSIVE mode (all active bots disabled).');
  
  await imsBot.start();
  await imsBot2.start();
  await smshadiBot.start();

  console.log('✓ All bots skipped. Website focus mode active.');
  
  // Keep the process alive so Docker doesn't restart it constantly
  console.log('Service staying alive in passive mode...');
  setInterval(() => {
    console.log('Heartbeat: Bot service is active (Passive Mode)');
  }, 1000 * 60 * 10); 
}

run().catch(err => {
  console.error('Fatal error in bot runner:', err);
  process.exit(1);
});
