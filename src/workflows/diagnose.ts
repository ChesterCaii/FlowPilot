import { proxyActivities } from "@temporalio/workflow";
import type { Activities } from "../activities";
// We can't directly import the MCP adapter in workflows due to Temporal limitations,
// but we can reference it through proxy activities

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
  // Log workflow start with metric (would be MCP stream in real implementation)
  console.log(`🔄 Starting incident diagnosis workflow for metric: ${metricName}`);
  
  // Step 1: Use Bedrock to decide on action
  const decision = await decideAction(metricName);
  
  let report: string;
  let result: string;
  let success: boolean = true;

  // Step 2: Take action based on decision
  if (decision === "REBOOT") {
    try {
      // Log the remediation action (would be MCP A2A notification in real implementation)
      console.log(`🔄 Sending A2A notification: Rebooting ${metricName}`);
      
      const cmd = `kubectl rollout restart deployment/${metricName}-svc -n default`;
      result = await executeCommand(cmd);
      report = `✅ Rebooted ${metricName} at ${new Date().toISOString()}. Result: ${result}`;
      success = true;
      
      // Log completion (would be MCP A2A task completion in real implementation)
      console.log(`✅ A2A task completed: Reboot of ${metricName} successful`);
    } catch (error) {
      result = `Error: ${error}`;
      report = `❌ Failed to reboot ${metricName} at ${new Date().toISOString()}. Error: ${error}`;
      success = false;
      
      // Log failure (would be MCP A2A task failure in real implementation)
      console.log(`❌ A2A task failed: Reboot of ${metricName} failed with ${error}`);
    }
  } else {
    result = "No action taken";
    report = `ℹ️ Ignored ${metricName} at ${new Date().toISOString()}, determined no action needed.`;
    
    // Log decision (would be MCP A2A notification in real implementation)
    console.log(`ℹ️ A2A notification: Decided to ignore ${metricName}`);
  }

  // Create artifact metadata for reporting
  const artifactMetadata = {
    incident_id: `incident-${Date.now()}`,
    metric: metricName,
    timestamp: new Date().toISOString(),
    decision: decision,
    result: result,
    success: success
  };
  
  // Log artifact creation (would be MCP artifact in real implementation)
  console.log(`🏺 Creating MCP artifact: ${JSON.stringify(artifactMetadata)}`);

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
  
  // Log completion of workflow (would be MCP stream completion in real implementation)
  console.log(`🏁 Workflow completed with MCP stream: ${metricName}-${Date.now()}`);
  
  // Return additional info for debugging
  console.log("Workflow completed with:", {
    decision,
    translations,
    diagramPath,
    success,
    mcp_artifact_id: artifactMetadata.incident_id
  });
}
