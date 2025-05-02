import AWS from "aws-sdk";
import dotenv from "dotenv";
dotenv.config();

// Create a BedrockRuntime client
const bedrock = new AWS.BedrockRuntime({
  region: process.env.AWS_REGION,
});


export async function decideAction(metricName: string): Promise<"REBOOT"|"IGNORE"> {
  console.log(`🔍 [stub] decideAction called for metric: ${metricName}`);
  // TODO: swap back to Bedrock in future
  return "REBOOT"; // or randomly choose between REBOOT/IGNORE
}



/** Mock remediation step – pretend we restart a Kubernetes pod */
export async function remediate(pod: string): Promise<void> {
  console.log(`🔧   Restarting pod ${pod}...`);
  await new Promise(r => setTimeout(r, 2000));
  console.log(`✅   Pod ${pod} back online`);
}
