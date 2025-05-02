import { decideAction } from './activities';

async function test() {
  try {
    console.log('Testing decideAction with high latency alarm...');
    const result = await decideAction('pod-latency-high');
    console.log('Decision:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test(); 