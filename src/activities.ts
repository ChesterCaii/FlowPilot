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

  const prompt = `Alert received: ${metricName}
Should I REBOOT or IGNORE? Respond with exactly one word: REBOOT or IGNORE.`;

  // Debug: show which model & region we're using
  const modelId = process.env.BEDROCK_MODEL_ID!;
  console.log(`DEBUG: BEDROCK_MODEL_ID=${modelId}, AWS_REGION=${process.env.AWS_REGION}`);

  // Build base params
  const params: any = {
    modelId,
    contentType: "application/json",
    accept: "application/json",
  };

  // Branch body shape for Titan on-demand vs. Claude provisioned
  if (modelId.startsWith("amazon.titan-text")) {
    params.body = JSON.stringify({
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: 10,
        stopSequences: [],
        temperature: 0,
        topP: 1.0,
      },
    });
  } else {
    params.body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });
  }

  // Debug: show exact payload sent to Bedrock
  console.log("❓ Bedrock request payload:", params.body);

  try {
    console.log("Invoking Bedrock…");
    const response = await (bedrock as any).invokeModel(params).promise();
    const body = JSON.parse(response.body.toString());

    // Extract raw text depending on model type
    let raw: string;
    if (modelId.startsWith("amazon.titan-text")) {
      raw = (body.outputText || body.generatedText || "").trim().toUpperCase();
    } else {
      raw = (body.content?.[0]?.text || "").trim().toUpperCase();
    }

    console.log(`Raw Bedrock response: ${raw}`);
    return raw === "REBOOT" ? "REBOOT" : "IGNORE";
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
    console.log("VIZCOM_KEY not found, using mock diagram");
    return "mock-diagram.png";
  }

  try {
    // Enhance the prompt to create a better system diagram
    const diagramPrompt = `Create a technical diagram showing the system state for this incident: ${report}. 
      Show affected components, connections between services, and highlight the issue area.`;
    
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
  } catch (err) {
    console.error("❌ Vizcom diagram generation failed:", err);
    return "Failed to generate diagram";
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
    console.log("RIME_KEY not found, skipping voice alert");
    return;
  }

  try {
    // Create a concise version of the message for speech
    const speechContent = `Alert! ${message.substring(0, 200)}`;
    
    const response = await axios.post(
      "https://api.rime.ai/v1/speak",
      {
        text: speechContent,
        voice_id: "calm", // Use a calm voice for alerts
        audio_format: "mp3"
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.RIME_KEY}`,
          "Content-Type": "application/json"
        },
        responseType: 'arraybuffer'
      }
    );
    
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
  } catch (err) {
    console.error("❌ Rime voice generation failed:", err);
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
