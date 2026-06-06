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
}

run().catch(err => {
  console.error('Fatal error in bot runner:', err);
  process.exit(1);
});
