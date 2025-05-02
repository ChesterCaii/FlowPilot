import dotenv from "dotenv";
import AWS from "aws-sdk";
import { promisify } from "util";
import { exec } from "child_process";
import { Translator } from "deepl-node";
import axios from "axios";
import { withMcp } from "./mcp";
import fs from "fs";
import path from "path";

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
  if (command.startsWith("kubectl")) {
    console.log("🔧 Simulating Kubernetes restart...");
    await new Promise(r => setTimeout(r, 2000));
    return "Simulated: pod restarted";
  }
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
  
  // After translations are done, generate diagram and voice alert
  try {
    await generateDiagram(report);
    await speakAlert(report);
  } catch (err) {
    console.error("Error with post-translation actions:", err);
  }
  
  return results;
});

// ──────────────────────────────────────────────────────────
// 4) Vizcom diagram generation ($3000 prize)
// ──────────────────────────────────────────────────────────
export const generateDiagram = withMcp("generateDiagram", async (
  report: string
): Promise<string> => {
  console.log("🎨 Generating system diagram with Vizcom...");
  
  if (!process.env.VIZCOM_KEY) {
    console.log("⚠️ VIZCOM_KEY not found in .env, using mock diagram");
    
    // Create a mock diagram file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mock-diagram-${timestamp}.txt`;
    const filepath = path.join(process.cwd(), 'diagrams', filename);
    
    // Create diagrams directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'diagrams'))) {
      fs.mkdirSync(path.join(process.cwd(), 'diagrams'));
    }
    
    // Create a simple ASCII art diagram
    const mockDiagram = `
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
    |                     |      |                     |
    +---------------------+      +---------------------+
    
    Incident: ${report}
    `;
    
    fs.writeFileSync(filepath, mockDiagram);
    console.log(`✅ Mock diagram saved to ${filepath}`);
    return filepath;
  }

  try {
    // Enhance the prompt to create a better system diagram
    const diagramPrompt = `Create a technical diagram showing the system state for this incident: ${report}. 
      Show affected components, connections between services, and highlight the issue area.`;
    
    console.log(`Sending prompt to Vizcom: "${diagramPrompt.substring(0, 50)}..."`);
    
    const response = await axios.post(
      "https://api.vizcom.ai/v1/generate",
      { prompt: diagramPrompt },
      { 
        headers: {
          "Authorization": `Bearer ${process.env.VIZCOM_KEY}`,
          "Content-Type": "application/json"
        },
        responseType: 'arraybuffer'
      }
    );
    
    console.log("Vizcom response received, status:", response.status);
    
    // Save the diagram to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `diagram-${timestamp}.png`;
    const filepath = path.join(process.cwd(), 'diagrams', filename);
    
    // Create diagrams directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'diagrams'))) {
      fs.mkdirSync(path.join(process.cwd(), 'diagrams'));
    }
    
    fs.writeFileSync(filepath, response.data);
    console.log(`✅ Diagram saved to ${filepath}`);
    return filepath;
  } catch (err: any) {
    console.error("❌ Vizcom diagram generation failed:", err.message);
    if (err.response) {
      console.error("Response status:", err.response.status);
      console.error("Response data:", err.response.data);
    }
    
    // Fall back to creating a mock diagram on error
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `fallback-diagram-${timestamp}.txt`;
    const filepath = path.join(process.cwd(), 'diagrams', filename);
    
    // Create diagrams directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'diagrams'))) {
      fs.mkdirSync(path.join(process.cwd(), 'diagrams'));
    }
    
    // Create a simple ASCII art diagram
    const mockDiagram = `
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
    |                     |      |                     |
    +---------------------+      +---------------------+
    
    Incident: ${report}
    `;
    
    fs.writeFileSync(filepath, mockDiagram);
    console.log(`✅ Fallback diagram saved to ${filepath}`);
    return filepath;
  }
});

// ──────────────────────────────────────────────────────────
// 5) Rime voice alerts ($2000 prize)
// ──────────────────────────────────────────────────────────
export const speakAlert = withMcp("speakAlert", async (
  message: string
): Promise<void> => {
  console.log("🔊 Creating voice alert with Rime...");
  
  if (!process.env.RIME_KEY) {
    console.log("⚠️ RIME_KEY not found in .env, skipping voice alert");
    return;
  }

  // Create a concise version of the message for speech - moved outside try/catch
  const speechContent = `Alert! ${message.substring(0, 200)}`;
  
  try {
    console.log(`Sending speech content to Rime: "${speechContent.substring(0, 50)}..."`);
    
    // Try a different endpoint format
    const response = await axios.post(
      "https://api.rime.ai/v1/audio/speech/synthesize",
      {
        text: speechContent,
        voice: "default"
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.RIME_KEY}`,
          "Content-Type": "application/json"
        },
        responseType: 'arraybuffer'
      }
    );
    
    console.log("Rime response received, status:", response.status);
    
    // Save the audio file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `alert-${timestamp}.mp3`;
    const filepath = path.join(process.cwd(), 'audio', filename);
    
    // Create audio directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'audio'))) {
      fs.mkdirSync(path.join(process.cwd(), 'audio'));
    }
    
    fs.writeFileSync(filepath, response.data);
    console.log(`✅ Voice alert saved to ${filepath}`);
    
    // TODO: Add code to play the audio file (platform dependent)
    console.log("🔊 Voice alert generated! Would play audio in production.");
  } catch (err: any) {
    console.error("❌ Rime voice generation failed:", err.message);
    if (err.response) {
      console.error("Response status:", err.response.status);
      console.error("Response headers:", JSON.stringify(err.response.headers));
      // Try to parse the response data if it's a buffer
      if (err.response.data instanceof Buffer) {
        try {
          const jsonStr = err.response.data.toString('utf8');
          console.error("Response data:", jsonStr);
        } catch (e) {
          console.error("Response data is binary and couldn't be parsed");
        }
      } else {
        console.error("Response data:", err.response.data);
      }
    }
    
    // Create a mock audio file on failure
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mock-alert-${timestamp}.txt`;
    const filepath = path.join(process.cwd(), 'audio', filename);
    
    // Create audio directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'audio'))) {
      fs.mkdirSync(path.join(process.cwd(), 'audio'));
    }
    
    // Create a text file with the intended speech content
    fs.writeFileSync(filepath, `MOCK AUDIO FILE: ${speechContent}`);
    console.log(`✅ Mock audio file saved to ${filepath} (Rime API failed)`);
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
