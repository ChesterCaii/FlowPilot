import { summarize } from './activities';

async function testSummarize() {
  console.log('🧪 Testing summarize function...\n');
  
  const testReport = "Critical alert: High CPU usage detected on production server. Memory utilization at 95%. Immediate attention required.";
  
  try {
    const results = await summarize(testReport);
    console.log('\n✅ Test completed successfully!');
    console.log('Results structure:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSummarize(); 