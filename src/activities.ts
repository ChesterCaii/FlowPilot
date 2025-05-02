// src/activities.ts
import dotenv from "dotenv";
import AWS from "aws-sdk";
import { exec } from "child_process";
import util from "util";
import { Translator } from "deepl-node";

dotenv.config();

const execAsync = util.promisify(exec);

// AWS Bedrock client (placeholder)
const bedrock = new AWS.BedrockRuntime({
  region: process.env.AWS_REGION,
});

// DeepL client
const deepl = new Translator(process.env.DEEPL_API_KEY!);

// Define a type for the structured translation result
interface TranslationResult {
  lang: string;
  text: string;
}

/** Retrieve relevant context for the alert from Senso.ai */
export async function getContextFromSenso(query: string): Promise<string> {
  console.log(`Querying Senso.ai for context related to: ${query}`);
  try {
    // Replace with real Senso.ai SDK call
    const context = `Senso.ai context for ${query}: System X has known memory leak issues on Tuesdays.`; // Mock result
    console.log("Senso.ai context retrieved:", context);
    return context;
  } catch (error) {
    console.error("Senso.ai query failed:", error);
    return ""; // Fail-safe: return empty context
  }
}

/** Decide whether to reboot or ignore using Bedrock, with Senso context. */
export async function decideAction(
  metricName: string,
  sensoContext: string
): Promise<"REBOOT" | "IGNORE"> {
  console.log(`Deciding action for ${metricName} with context: ${sensoContext}`);

  const prompt = `
    Alert received: ${metricName}
    Relevant context from knowledge base: ${sensoContext || "None available."}
    Based on the alert and context, should I REBOOT the affected service or IGNORE the alert?
    Respond with only REBOOT or IGNORE.
  `;

  try {
    // Replace with actual Bedrock model call
    const decision = Math.random() > 0.5 ? "REBOOT" : "IGNORE"; // Mock decision
    console.log(`AI decision for ${metricName}: ${decision}`);
    return decision;
  } catch (error) {
    console.error("Bedrock decision failed:", error);
    return "IGNORE";
  }
}

/** Execute the reboot command using the system shell or simulate it. */
export async function executeCommandWithBlockGoose(command: string): Promise<string> {
  console.log(`Received command: ${command}`);
  
  // Check if this is a kubectl command
  if (command.startsWith('kubectl')) {
    // Simulate the kubectl command for development
    console.log('🔧 Simulating Kubernetes command...');
    console.log(`📦 Would have executed: ${command}`);
    await new Promise(r => setTimeout(r, 2000)); // Simulate some work
    return `Simulation: Successfully restarted deployment (Development Mode)`;
  }

  // For non-kubectl commands, try to execute them normally
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) console.error("Command stderr:", stderr);
    console.log("Command stdout:", stdout);
    return stdout.trim();
  } catch (error: any) {
    console.error("Command execution failed:", error);
    throw new Error(`Command failed: ${error.message}`);
  }
}

/**
 * Translate an incident report into French and German using DeepL.
 * Returns the original report plus translations.
 */
export async function summarize(report: string): Promise<TranslationResult[]> {
  console.log("\n--- 📝 Generating Incident Summary --- ");
  console.log(`Original Report (EN): ${report}`);

  const targets = ["fr", "de"] as const; // Target languages for translation
  const results: TranslationResult[] = [{ lang: "EN", text: report }]; // Start with English

  try {
    const translationPromises = targets.map(async (lang) => {
      try {
        const result = await deepl.translateText(report, null, lang); // Use null for sourceLang to auto-detect
        return { lang: lang.toUpperCase(), text: result.text }; // Convert to uppercase for display
      } catch (error) {
        console.error(`DeepL translation to ${lang} failed:`, error);
        return { lang: lang.toUpperCase(), text: `[Translation Error to ${lang.toUpperCase()}]` }; // Return error placeholder
      }
    });

    const translations = await Promise.all(translationPromises);
    results.push(...translations);

  } catch (error) {
    console.error("Error during DeepL translations:", error);
    // If Promise.all itself fails (unlikely with individual catches), add a general error
    results.push({ lang: "ERROR", text: "Failed to generate all translations." });
  }

  console.log("--- 🌐 Multi-Language Summary --- ");
  results.forEach(({ lang, text }) => {
    console.log(`[${lang}]: ${text}`);
  });
  console.log("----------------------------------\n");

  return results; // Return the structured results
}

// --- Export type for proxyActivities ---
import * as activities from "./activities";
export type Activities = typeof activities;
