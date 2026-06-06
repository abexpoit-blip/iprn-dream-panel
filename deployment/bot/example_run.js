const imsBot = require('./imsBot');
const imsBot2 = require('./imsBot2');
const smshadiBot = require('./smshadiBot');

async function run() {
  console.log('🤖 Nexus Bots starting...');
  
  // Start bots in parallel
  // In a real scenario we'd await them or use a process manager,
  // but here we just want them to start their loops.
  
  if (imsBot && typeof imsBot.start === 'function') {
    imsBot.start().catch(err => console.error('IMS Bot 1 failed to start:', err));
  } else {
    console.log('IMS Bot 1 export not found or start function missing');
  }

  if (imsBot2 && typeof imsBot2.start === 'function') {
    imsBot2.start().catch(err => console.error('IMS Bot 2 failed to start:', err));
  } else {
    console.log('IMS Bot 2 export not found or start function missing');
  }
  
  if (smshadiBot && typeof smshadiBot.start === 'function') {
    smshadiBot.start().catch(err => console.error('SMSHadi Bot failed to start:', err));
  }

  console.log('✓ All bots initialized and loops started.');
}

run().catch(err => {
  console.error('Fatal error in bot runner:', err);
  process.exit(1);
});
