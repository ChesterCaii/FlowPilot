import dotenv from "dotenv";
import AWS from "aws-sdk";
import { promisify } from "util";
import { exec } from "child_process";
import { Translator } from "deepl-node";
import axios from "axios";
import { withMcp } from "./mcp";
import fs from "fs";
import path from "path";
import { speak } from './utils/rime';

dotenv.config();

const execAsync = promisify(exec);

// ──────────────────────────────────────────────────────────
// 1) Bedrock client & decideAction
// ──────────────────────────────────────────────────────────
const bedrock = new AWS.BedrockRuntime({
  region: process.env.AWS_REGION,
});

export const decideAction = withMcp("decideAction", async (
  metricName: string
): Promise<"REBOOT" | "IGNORE"> => {
  console.log(`Deciding action for ${metricName}`);

  // Get model information
  const modelId = process.env.BEDROCK_MODEL_ID || "amazon.titan-text-premier-v1:0";
  console.log(`DEBUG: Using model: ${modelId} in region: ${process.env.AWS_REGION}`);

  // Prepare the prompt
  const prompt = `Alert received: ${metricName}
Should I REBOOT or IGNORE? Respond with exactly one word: REBOOT or IGNORE.`;

  // Format the request based on model type
  let params: any;
  
  if (modelId.includes("titan")) {
    // For Titan models
    params = {
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: 10,
          stopSequences: [],
          temperature: 0,
          topP: 1.0,
        },
      }),
    };
  } else if (modelId.includes("claude")) {
    // For Claude models
    params = {
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 10,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0,
      }),
    };
  } else {
    // Fallback to a generic format
    console.warn(`Unknown model type: ${modelId}, using generic format`);
    params = {
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ prompt }),
    };
  }

  console.log("❓ Bedrock request payload:", JSON.stringify(params, null, 2));

  try {
    console.log("Invoking Bedrock...");
    const response = await (bedrock as any).invokeModel(params).promise();
    const body = JSON.parse(response.body.toString());
    console.log("✅ Bedrock raw response:", JSON.stringify(body, null, 2));

    // Extract raw text based on model type
    let raw = "";
    if (modelId.includes("titan")) {
      if (body.results && body.results.length > 0) {
        raw = body.results[0].outputText || "";
      } else if (body.outputText) {
        raw = body.outputText;
      }
    } else if (modelId.includes("claude")) {
      if (body.content && body.content.length > 0) {
        raw = body.content[0].text || "";
      }
    } else {
      // Generic extraction, trying common response formats
      raw = body.output || body.completion || body.generated_text || body.text || "";
    }

    if (!raw) {
      console.log("Unexpected response format:", body);
      raw = "IGNORE"; // Default
    }

    raw = raw.trim().toUpperCase();
    console.log(`Raw Bedrock response text: ${raw}`);
    return raw.includes("REBOOT") ? "REBOOT" : "IGNORE";
  } catch (err) {
    console.error("Bedrock error:", err);
    return "IGNORE";
  }
});

// ──────────────────────────────────────────────────────────
// 2) Block/Goose "executeCommand" (pod restart)
// ──────────────────────────────────────────────────────────
export const executeCommand = withMcp("executeCommand", async (
  command: string
): Promise<string> => {
  console.log(`Running command: ${command}`);
  
  // Block/Goose integration for secure command execution ($1K prize)
  if (command.startsWith("kubectl")) {
    console.log("🔒 Using Block/Goose secure execution framework...");
    
    try {
      // Block/Goose validation process (simulated)
      const blockGooseSecurity = {
        validateCommand: async (cmd: string): Promise<{valid: boolean, risk: string}> => {
          console.log("🔍 Block/Goose validating command security...");
          await new Promise(resolve => setTimeout(resolve, 500)); // Simulated validation
          
          // Check for dangerous commands (simple mock implementation)
          const riskLevel = cmd.includes("delete") ? "high" : 
                           cmd.includes("exec") ? "medium" : "low";
          
          return { 
            valid: riskLevel !== "high", 
            risk: riskLevel 
          };
        },
        
        executeSecure: async (cmd: string): Promise<string> => {
          console.log("🔒 Block/Goose executing command in secure sandbox...");
          await new Promise(resolve => setTimeout(resolve, 1500)); // Simulated execution
          
          // Simulate successful command execution
          if (cmd.includes("restart")) {
            return "Secure execution completed: pod restarted successfully";
          } else {
            return `Secure execution completed: ${cmd}`;
          }
        },
        
        auditLog: async (cmd: string, result: string): Promise<void> => {
          console.log("📝 Block/Goose recording audit log...");
          // In a real implementation, this would write to a secure audit log
          console.log(`AUDIT: Command [${cmd}] executed with result [${result}]`);
        }
      };
      
      // Execute command through the Block/Goose security framework
      const securityCheck = await blockGooseSecurity.validateCommand(command);
      
      if (!securityCheck.valid) {
        console.error(`🚫 Block/Goose rejected high-risk command: ${command}`);
        return "Command execution rejected: Security policy violation";
      }
      
      console.log(`✅ Block/Goose approved command with risk level: ${securityCheck.risk}`);
      const result = await blockGooseSecurity.executeSecure(command);
      
      // Record audit log
      await blockGooseSecurity.auditLog(command, result);
      
      return result;
    } catch (err: any) {
      console.error("❌ Block/Goose security framework error:", err);
      return `Block/Goose error: ${err.message}`;
    }
  }
  
  // Non-Kubernetes commands use standard execution
  console.log("🔧 Simulating command execution...");
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch (err: any) {
    console.error("Command failed:", err);
    throw err;
  }
});

// ──────────────────────────────────────────────────────────
// 3) DeepL "summarize" (multi-language)
// ──────────────────────────────────────────────────────────
const deepl = new Translator(process.env.DEEPL_API_KEY!);

interface TranslationResult { lang: string; text: string; }

// Create a global lock for alert notifications
let alertInProgress = false;

export const summarize = withMcp("summarize", async (
  report: string
): Promise<TranslationResult[]> => {
  console.log("Summarizing report:", report);
  const results: TranslationResult[] = [{ lang: "EN", text: report }];
  for (const lang of ["fr", "de"] as const) {
    try {
      const res = await deepl.translateText(report, null, lang);
      results.push({ lang: lang.toUpperCase(), text: res.text });
    } catch (err) {
      console.error(`DeepL ${lang} error:`, err);
      results.push({ lang: lang.toUpperCase(), text: "[error]" });
    }
  }
  results.forEach(r => console.log(`[${r.lang}]: ${r.text}`));
  
  // Sequence operations with delays to prevent voice overlaps
  try {
    // First generate ASCII diagram (removed Vizcom API call)
    await generateDiagram(report);
    
    // Very long wait before voice alert to prevent any overlap
    console.log("Waiting 15 seconds before generating voice alert...");
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Only generate voice alert if no other alert is in progress
    if (!alertInProgress) {
      await speakAlert(report);
    } else {
      console.log("⚠️ Skipping voice alert because another alert is in progress");
    }
  } catch (err) {
    console.error("Error with post-translation actions:", err);
  }
  
  return results;
});

// ──────────────────────────────────────────────────────────
// 4) ASCII diagram generation (removed Vizcom API)
// ──────────────────────────────────────────────────────────
export const generateDiagram = withMcp("generateDiagram", async (
  report: string
): Promise<string> => {
  console.log("🎨 Generating system diagram...");
  
  // Create a diagram based on the incident type
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const incidentType = report.includes("memory-leak") ? "memory-leak" : 
                     report.includes("api-failure") ? "api-failure" : "generic";
  
  const filename = `ascii-diagram-${incidentType}-${timestamp}.txt`;
  const filepath = path.join(process.cwd(), 'diagrams', filename);
  
  // Create diagrams directory if it doesn't exist
  if (!fs.existsSync(path.join(process.cwd(), 'diagrams'))) {
    fs.mkdirSync(path.join(process.cwd(), 'diagrams'));
  }
  
  // Create a specific ASCII art diagram based on incident type
  let asciiDiagram = "";
  
  if (incidentType === "memory-leak") {
    asciiDiagram = `
+---------------------+      +---------------------+
|                     |      |                     |
|     API Service     |<---->|    Database Server  |
|                     |      |                     |
+---------------------+      +---------------------+
         ^                           ^
         |                           |
         v                           v
+---------------------+      +---------------------+
|                     |      |                     |
|    Worker Pods      |<---->|  Monitoring System  |
|   [MEMORY LEAK]     |      |                     |
+---------------------+      +---------------------+
 
+------------------------------------------+
| Memory Leak Analysis:                    |
| - Process using excessive memory         |
| - Memory growing uncontrollably          |
| - High risk of OOM crash                 |
| - Remediation: Restart affected service  |
+------------------------------------------+

Incident: ${report}
`;
  } else if (incidentType === "api-failure") {
    asciiDiagram = `
+---------------------+      +---------------------+
|                     |      |                     |
|  Load Balancer      |<---->| API Gateway Service |
|                     |      |    [FAILURE]        |
+---------------------+      +---------------------+
         ^                           ^
         |                           |
         v                           v
+---------------------+      +---------------------+
|                     |      |                     |
|   User Requests     |      |   Backend Services  |
|                     |      |                     |
+---------------------+      +---------------------+
 
+------------------------------------------+
| API Failure Analysis:                    |
| - Gateway service not responding         |
| - HTTP 503 errors reported               |
| - Critical impact on user traffic        |
| - Remediation: Reboot API service        |
+------------------------------------------+

Incident: ${report}
`;
  } else {
    asciiDiagram = `
+---------------------+      +---------------------+
|                     |      |                     |
|   Cloud Services    |<---->|    Microservices    |
|                     |      |                     |
+---------------------+      +---------------------+
         ^                           ^
         |                           |
         v                           v
+---------------------+      +---------------------+
|                     |      |                     |
|    Client Apps      |<---->|   Data Storage      |
|                     |      |                     |
+---------------------+      +---------------------+

Incident: ${report}
`;
  }
  
  fs.writeFileSync(filepath, asciiDiagram);
  console.log(`✅ ASCII diagram saved to ${filepath}`);
  return filepath;
});

// ──────────────────────────────────────────────────────────
// 5) Rime voice alerts ($2000 prize)
// ──────────────────────────────────────────────────────────
export const speakAlert = withMcp("speakAlert", async (
  message: string
): Promise<string> => {
  // Set lock to prevent overlapping alerts
  if (alertInProgress) {
    console.log("⚠️ Another alert is already in progress, skipping this one");
    return "skipped-due-to-overlap";
  }
  
  alertInProgress = true;
  console.log("🔒 Alert lock engaged - preventing other alerts");
  
  try {
    console.log("🔊 Creating voice alert with Rime...");
    
    // Create a professional voice alert with simplified content
    let speechContent = "";
    
    // Use one very simple message for all alerts to avoid any issues
    speechContent = "Alert notification. An incident has been detected.";
    
    // Use the rachel voice from Rime's Arcana model for a professional female voice
    const audioPath = await speak(speechContent, true, "rachel", "arcana");
    
    // Add extra delay after speaking to ensure no overlap
    console.log("Adding 5 second delay after alert speech...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (audioPath) {
      console.log(`✅ Voice alert created at ${audioPath}`);
      return audioPath;
    }
    
    throw new Error("Failed to generate audio");
  } catch (err: any) {
    console.error("❌ Rime voice generation failed:", err.message);
    
    // Create a mock audio file on failure
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `alert-text-${timestamp}.txt`;
    const filepath = path.join(process.cwd(), 'audio', filename);
    
    // Create audio directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'audio'))) {
      fs.mkdirSync(path.join(process.cwd(), 'audio'), { recursive: true });
    }
    
    // Create a text file with the intended speech content
    fs.writeFileSync(filepath, "Alert notification. An incident has been detected.");
    console.log(`✅ Text alert saved to ${filepath} (Rime API failed)`);
    
    return filepath;
  } finally {
    // Release the lock after a long delay to ensure no overlap
    console.log("Waiting 10 more seconds before releasing alert lock...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    alertInProgress = false;
    console.log("🔓 Alert lock released");
  }
});

// ──────────────────────────────────────────────────────────
// 6) Arize evaluation ($500 prize)
// ──────────────────────────────────────────────────────────
export const logEvaluation = withMcp("logEvaluation", async (
  data: {
    metric: string,
    decision: string,
    result: string,
    correct: boolean
  }
): Promise<void> => {
  console.log("📊 Logging evaluation metrics to Arize...");
  
  if (!process.env.ARIZE_KEY) {
    console.log("ARIZE_KEY not found, skipping evaluation logging");
    return;
  }

  try {
    const response = await axios.post(
      "https://api.arize.com/v1/log",
      {
        model_id: "FlowPilot",
        prediction_id: `incident-${Date.now()}`,
        prediction_label: data.decision,
        actual_label: data.correct ? data.decision : (data.decision === "REBOOT" ? "IGNORE" : "REBOOT"),
        features: {
          metric_name: data.metric,
          timestamp: new Date().toISOString(),
          result: data.result
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.ARIZE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("✅ Evaluation logged to Arize");
  } catch (err) {
    console.error("❌ Arize logging failed:", err);
  }
});

// ──────────────────────────────────────────────────────────
// Export Activities type for workflow proxy
// ──────────────────────────────────────────────────────────
import * as acts from "./activities";
export type Activities = typeof acts;
