/**
 * MCP Integration for FlowPilot
 * 
 * This file demonstrates how to integrate the MCPStreamer with Temporal activities
 * for agent-to-agent communication and artifact creation.
 */

import { mcpStreamer, A2ANotifier } from './protocols/mcpAdapter';
import { withMcp } from './mcp';

/**
 * Enhanced version of the decideAction activity with MCP integration
 * This would replace or enhance the existing activity in a real implementation
 */
export const decideActionWithMCP = withMcp("decideAction", async (
  metricName: string
): Promise<"REBOOT" | "IGNORE"> => {
  // Create an MCP stream for this decision process
  const streamId = mcpStreamer.createStream(`decision-${metricName}`);
  
  // Real implementation would call the actual decideAction activity here
  console.log(`Making decision for ${metricName} via MCP stream ${streamId}`);
  
  // Simulate decision logic
  const decision = Math.random() > 0.5 ? "REBOOT" : "IGNORE";
  
  // Publish the decision to the MCP stream
  await mcpStreamer.publish(streamId, {
    type: 'DECISION_MADE',
    metricName,
    decision,
    timestamp: new Date().toISOString()
  });
  
  return decision;
});

/**
 * Enhanced version of the executeCommand activity with MCP integration
 */
export const executeCommandWithMCP = withMcp("executeCommand", async (
  command: string
): Promise<string> => {
  // Create an A2A task for command execution
  const task = await A2ANotifier.createTask({
    type: 'COMMAND_EXECUTION',
    agents: ['system-agent', 'notification-agent']
  });
  
  // Notify agents about the command execution
  await task.sendMessage({
    role: 'executor',
    parts: [{
      text: `Executing command: ${command}`
    }]
  });
  
  // Real implementation would execute the command here
  console.log(`Simulating execution of: ${command}`);
  
  // Simulate command result
  const result = "Command executed successfully";
  
  // Complete the A2A task
  await task.complete({
    status: 'SUCCESS',
    result
  });
  
  return result;
});

/**
 * Enhanced version of the generateDiagram activity with MCP artifacts
 */
export const generateDiagramWithMCP = withMcp("generateDiagram", async (
  report: string
): Promise<string> => {
  // Create an MCP artifact for the diagram
  const artifactId = await mcpStreamer.createArtifact('diagram', {
    report,
    timestamp: new Date().toISOString()
  });
  
  // Real implementation would generate the diagram here
  console.log(`Generating diagram for report via MCP artifact ${artifactId}`);
  
  // Return the diagram path
  const diagramPath = `/diagrams/diagram-${new Date().getTime()}.png`;
  
  return diagramPath;
});

/**
 * Example of using the MCP integration in a workflow-like sequence
 */
export async function demonstrateMCPIntegration(metricName: string): Promise<void> {
  console.log(`🚀 Starting MCP integrated workflow for ${metricName}`);
  
  // Use MCP to decide action
  const decision = await decideActionWithMCP(metricName);
  
  if (decision === "REBOOT") {
    // Execute command with A2A notifications
    const cmd = `kubectl rollout restart deployment/${metricName}-svc -n default`;
    const result = await executeCommandWithMCP(cmd);
    console.log(`Command result: ${result}`);
  } else {
    console.log(`Decision was to ignore ${metricName}`);
  }
  
  // Generate a diagram with MCP artifact
  const report = `Incident report for ${metricName}`;
  const diagramPath = await generateDiagramWithMCP(report);
  console.log(`Diagram generated at: ${diagramPath}`);
  
  console.log(`✅ MCP integration demonstration completed for ${metricName}`);
}

// This function can be called to demonstrate the MCP integration
if (require.main === module) {
  demonstrateMCPIntegration("test-metric")
    .then(() => console.log("MCP demo completed"))
    .catch(err => console.error("MCP demo failed:", err));
} 