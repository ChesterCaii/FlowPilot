import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { Connection, Client } from "@temporalio/client";
import dotenv from "dotenv";
dotenv.config();

async function startServer() {
  // 1. connect to Temporal
  const connection = await Connection.connect();
  const client = new Client({ connection });

  // 2. create Express app
  const app = express().use(bodyParser.json());
  app.post("/alarm", async (req: Request, res: Response) => {
    const metricName = (req.body?.AlarmName as string) ?? "UnknownMetric";
    await client.workflow.start("diagnose", {
      args: [metricName],
      taskQueue: "flowpilot",
      workflowId: `wf-${Date.now()}`
    });
    res.status(200).send("FlowPilot triggered");
  });

  // 3. listen
  app.listen(3000, () => console.log("🚀 FlowPilot listening on http://localhost:3000"));
}

startServer().catch(err => {
  console.error("❌ Failed to start FlowPilot API:", err);
  process.exit(1);
});
