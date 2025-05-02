import { Connection, Client } from "@temporalio/client";
import dotenv from "dotenv";
dotenv.config();

const TEST_METRICS = [
  "high-cpu-usage",
  "memory-leak",
  "database-connection-failure",
  "api-latency-spike",
  "disk-space-warning"
];

async function runTest() {
  console.log("🚀 FlowPilot Test Harness");
  console.log("========================\n");
  
  // Connect to Temporal
  console.log("Connecting to Temporal...");
  const connection = await Connection.connect();
  const client = new Client({ connection });
  
  // Pick a test metric randomly if not specified
  const testMetricIndex = Math.floor(Math.random() * TEST_METRICS.length);
  const metricName = process.argv[2] || TEST_METRICS[testMetricIndex];
  
  console.log(`\n🔔 Simulating alert for: ${metricName}`);
  
  // Start the workflow
  try {
    const handle = await client.workflow.start("diagnose", {
      args: [metricName],
      taskQueue: "flowpilot",
      workflowId: `test-${Date.now()}`
    });
    
    console.log(`\n✅ Workflow started with ID: ${handle.workflowId}`);
    console.log("Waiting for workflow to complete...\n");
    
    // Wait for workflow completion
    await handle.result();
    console.log("\n🎉 Workflow completed successfully!");
    
    // Output the workflow result
    console.log("\nWorkflow details:");
    console.log(`- ID: ${handle.workflowId}`);
    console.log(`- Status: Completed`);
    console.log(`- Start time: ${new Date().toISOString()}`);
    console.log(`\nCheck the 'diagrams' and 'audio' directories for generated assets.`);
    
  } catch (error) {
    console.error("\n❌ Workflow failed:", error);
  }
  
  process.exit(0);
}

runTest().catch(err => {
  console.error("Test harness error:", err);
  process.exit(1);
}); 