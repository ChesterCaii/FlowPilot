import { proxyActivities } from "@temporalio/workflow";
import type * as acts from "../activities";

const { decideAction, remediate, summarize } = proxyActivities<typeof acts>({
  startToCloseTimeout: "1 minute"
});

export async function diagnose(metricName: string): Promise<void> {
  const action = await decideAction(metricName);
  if (action === "REBOOT") {
    await remediate("payments-1");
    const report = `Rebooted payments-1 for ${metricName} at ${new Date().toISOString()}`;
    await summarize(report);
  }
  // later: call a DeepL summary step here
}
