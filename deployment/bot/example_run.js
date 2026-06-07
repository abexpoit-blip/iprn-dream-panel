// example_run.js
const imsBot = require('./imsBot');

async function run() {
  console.log('🤖 Nexus Bots service initializing...');
  
  await imsBot.start();

  console.log('✓ IMS Bot started.');
  
  // Keep the process alive
  setInterval(() => {
    console.log('Heartbeat: Bot service is active');
  }, 1000 * 60 * 10); 
}

run().catch(err => {
  console.error('Fatal error in bot runner:', err);
  process.exit(1);
});
