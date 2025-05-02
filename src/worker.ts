import { Worker } from "@temporalio/worker";
import * as activities from "./activities";

// Force-reload to prevent caching issues
console.log("Starting worker with activities:", Object.keys(activities));

(async () => {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows/diagnose"),
    activities,
    taskQueue: "flowpilot"
  });
  
  console.log("Worker created, starting...");
  
  await worker.run();
})().catch(err => {
  console.error("Worker error:", err);
  process.exit(1);
});
