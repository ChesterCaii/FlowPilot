import dotenv from "dotenv";
import { decideAction, summarize, generateDiagram, speakAlert, logEvaluation } from "./activities";
dotenv.config();

// Test functions
async function testBedrock() {
  console.log("🧠 Testing Bedrock decision making...");
  
  try {
    const result = await decideAction("memory-leak");
    console.log("✅ Bedrock test successful:", result);
  } catch (error: any) {
    console.error("❌ Bedrock test failed:", error.message);
  }
}

async function testDeepL() {
  console.log("\n🌐 Testing DeepL translation...");
  
  try {
    const testReport = "Critical incident: Memory leak detected in API service. Restarted the pod at 2025-05-01T12:00:00Z. All systems now operational.";
    const results = await summarize(testReport);
    console.log("✅ DeepL test successful:", JSON.stringify(results, null, 2));
  } catch (error: any) {
    console.error("❌ DeepL test failed:", error.message);
  }
}

async function testVizcom() {
  console.log("\n🎨 Testing Vizcom diagram generation...");
  
  if (!process.env.VIZCOM_KEY) {
    console.log("⚠️ VIZCOM_KEY not found in .env, skipping test");
    return;
  }
  
  try {
    const testPrompt = "Database server crashed due to memory leak. Pod was restarted and is now operational.";
    const result = await generateDiagram(testPrompt);
    console.log("✅ Vizcom test successful:", result);
  } catch (error: any) {
    console.error("❌ Vizcom test failed:", error.message);
  }
}

async function testRime() {
  console.log("\n🔊 Testing Rime voice generation...");
  
  if (!process.env.RIME_KEY) {
    console.log("⚠️ RIME_KEY not found in .env, skipping test");
    return;
  }
  
  try {
    const testAlert = "Alert! High CPU usage detected. System restarted successfully at 12:15 PM.";
    await speakAlert(testAlert);
    console.log("✅ Rime test successful");
  } catch (error: any) {
    console.error("❌ Rime test failed:", error.message);
  }
}

async function testArize() {
  console.log("\n📊 Testing Arize evaluation logging...");
  
  if (!process.env.ARIZE_KEY) {
    console.log("⚠️ ARIZE_KEY not found in .env, skipping test");
    return;
  }
  
  try {
    await logEvaluation({
      metric: "test-cpu-spike",
      decision: "REBOOT",
      result: "System successfully restarted",
      correct: true
    });
    console.log("✅ Arize test successful");
  } catch (error: any) {
    console.error("❌ Arize test failed:", error.message);
  }
}

// Run all tests or specific test based on command line argument
async function runTests() {
  console.log("🧪 FlowPilot Component Test Suite");
  console.log("===============================\n");
  
  const testName = process.argv[2];
  
  if (!testName || testName === "all") {
    await testBedrock();
    await testDeepL();
    await testVizcom();
    await testRime();
    await testArize();
  } else if (testName === "bedrock") {
    await testBedrock();
  } else if (testName === "deepl") {
    await testDeepL();
  } else if (testName === "vizcom") {
    await testVizcom();
  } else if (testName === "rime") {
    await testRime();
  } else if (testName === "arize") {
    await testArize();
  } else {
    console.log(`Unknown test: ${testName}`);
    console.log("Available tests: bedrock, deepl, vizcom, rime, arize, all");
  }
  
  console.log("\n🏁 All tests completed");
}

runTests().catch(err => {
  console.error("Test runner error:", err);
  process.exit(1);
}); 