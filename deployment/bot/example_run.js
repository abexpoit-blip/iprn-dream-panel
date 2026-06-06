const imsBot = require('./imsBot');
const imsBot2 = require('./imsBot2');
const smshadiBot = require('./smshadiBot');

async function run() {
  console.log('🤖 Nexus Bots starting...');
  
  // Start bots in parallel
  if (imsBot && typeof imsBot.start === 'function') {
    console.log('Starting IMS Bot 1...');
    imsBot.start().catch(err => console.error('IMS Bot 1 failed to start:', err));
  }

  if (imsBot2 && typeof imsBot2.start === 'function') {
    console.log('Starting IMS Bot 2...');
    imsBot2.start().catch(err => console.error('IMS Bot 2 failed to start:', err));
  }
  
  if (smshadiBot && typeof smshadiBot.start === 'function') {
    console.log('Starting SMSHadi Bot...');
    smshadiBot.start().catch(err => console.error('SMSHadi Bot failed to start:', err));
  }

  console.log('✓ All bots initialized and loops started.');
}

run().catch(err => {
  console.error('Fatal error in bot runner:', err);
  process.exit(1);
});
