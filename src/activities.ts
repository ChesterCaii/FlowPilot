// src/activities.ts
import dotenv from "dotenv";
import AWS from "aws-sdk";
import { DeepL } from "deepl-node";

dotenv.config();

// Bedrock client (stubbed for now)
const bedrock = new AWS.BedrockRuntime({
  region: process.env.AWS_REGION,
});

// DeepL client
const deepl = new DeepL({
  apiKey: process.env.DEEPL_API_KEY!,
});

/** Decide whether to reboot or ignore (currently stubbed). */
export async function decideAction(metricName: string): Promise<"REBOOT"|"IGNORE"> {
  console.log(`🔍 [stub] decideAction called for metric: ${metricName}`);
  return "REBOOT";
}

/** Mock remediation: pretend we restart a Kubernetes pod. */
export async function remediate(pod: string): Promise<void> {
  console.log(`🔧 Restarting pod ${pod}...`);
  await new Promise(r => setTimeout(r, 2000));
  console.log(`✅ Pod ${pod} back online`);
}

/** Translate an incident report into French and German, logging each. */
export async function summarize(report: string): Promise<void> {
  console.log(`📝 summarize: ${report}`);
  const targets = ["FR", "DE"] as const;
  const translations = await Promise.all(
    targets.map(lang =>
      deepl.translateText(report, undefined, lang).then(res => ({
        lang,
        text: res.text,
      }))
    )
  );
  for (const { lang, text } of translations) {
    console.log(`🌐 [${lang}] ${text}`);
  }
}
