// example_run.js
const imsBot = require('./imsBot');
const sharkBot = require('./sharkBot');

async function run() {
  console.log('🤖 Nexus Bots service initializing...');
  
  // Start bots in parallel
  await Promise.all([
    imsBot.start(),
    sharkBot.start()
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
