import { proxyActivities } from "@temporalio/workflow";
import type * as acts from "../activities";

const { decideAction, remediate } = proxyActivities<typeof acts>({
  startToCloseTimeout: "1 minute"
});

export async function diagnose(metricName: string): Promise<void> {
  const action = await decideAction(metricName);
  if (action === "REBOOT") {
    await remediate("payments-1");
  }
  // later: call a DeepL summary step here
}
