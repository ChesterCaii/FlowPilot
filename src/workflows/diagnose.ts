import { proxyActivities } from "@temporalio/workflow";
import type { Activities } from "../activities";

// Include all activities we need for our workflow
const { 
  decideAction, 
  executeCommand,      
  summarize,
  generateDiagram,
  speakAlert,
  logEvaluation 
} = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
});

export async function diagnose(metricName: string): Promise<void> {
  // Step 1: Use Bedrock to decide on action
  const decision = await decideAction(metricName);
  
  let report: string;
  let result: string;
  let success: boolean = true;

  // Step 2: Take action based on decision
  if (decision === "REBOOT") {
    try {
      const cmd = `kubectl rollout restart deployment/${metricName}-svc -n default`;
      result = await executeCommand(cmd);
      report = `✅ Rebooted ${metricName} at ${new Date().toISOString()}. Result: ${result}`;
      success = true;
    } catch (error) {
      result = `Error: ${error}`;
      report = `❌ Failed to reboot ${metricName} at ${new Date().toISOString()}. Error: ${error}`;
      success = false;
    }
  } else {
    result = "No action taken";
    report = `ℹ️ Ignored ${metricName} at ${new Date().toISOString()}, determined no action needed.`;
  }

  // Step 3: Generate multi-language summary
  const translations = await summarize(report);
  
  // Step 4: Generate visualization diagram
  const diagramPath = await generateDiagram(report);
  
  // Step 5: Generate voice alert
  await speakAlert(report);
  
  // Step 6: Log the evaluation metrics for learning
  await logEvaluation({
    metric: metricName,
    decision: decision,
    result: result,
    correct: success
  });
  
  // Return additional info for debugging
  console.log("Workflow completed with:", {
    decision,
    translations,
    diagramPath,
    success
  });
}
