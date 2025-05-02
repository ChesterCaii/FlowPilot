import { Worker } from "@temporalio/worker";
import * as activities from "./activities";

(async () => {
  await Worker.create({
    workflowsPath: require.resolve("./workflows/diagnose"),
    activities,
    taskQueue: "flowpilot"
  }).then(w => w.run());
})();
