import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock";
import dotenv from "dotenv";
dotenv.config();

/** Decide next action with Bedrock (REBOOT or IGNORE) */
export async function decideAction(metricName: string): Promise<"REBOOT" | "IGNORE"> {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
  const prompt = `Latency alarm '${metricName}' fired. Should we REBOOT the pod? Answer only REBOOT or IGNORE.`;
  const res = await client.send(
    new InvokeModelCommand({
      modelId: process.env.BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
    })
  );
  const answer = JSON.parse(new TextDecoder().decode(res.body)).content.trim();
  return answer === "REBOOT" ? "REBOOT" : "IGNORE";
}

/** Mock remediation step – pretend we restart a Kubernetes pod */
export async function remediate(pod: string): Promise<void> {
  console.log(`🔧   Restarting pod ${pod}...`);
  await new Promise(r => setTimeout(r, 2000));
  console.log(`✅   Pod ${pod} back online`);
}
