import { speak } from './utils/rime';
import dotenv from 'dotenv';
dotenv.config();

// Get voice parameter from command line if provided
const voice = process.argv[2] || 'rachel';

async function testRime() {
  console.log('Testing Rime API with voice:', voice);
  
  if (!process.env.RIME_KEY) {
    console.error('❌ RIME_KEY not found in .env file');
    console.log('Please add your Rime API key to the .env file:');
    console.log('RIME_KEY=your_api_key_here');
    process.exit(1);
  }
  
  console.log('✓ RIME_KEY found in environment variables');
  console.log('Attempting to generate speech with Rime API...');
  
  try {
    // Always force Rime API usage (don't fall back to system voice)
    const result = await speak('This is a test of the Rime voice API. If you hear this, the integration is working correctly.', true, voice);
    
    if (result) {
      console.log('✅ Rime API test successful!');
      console.log('Audio saved at:', result);
    } else {
      console.error('❌ Failed to generate speech - no file returned');
    }
  } catch (err) {
    console.error('❌ Error testing Rime API:', err);
  }
}

// Run the test
testRime().catch(console.error); 