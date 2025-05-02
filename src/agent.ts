import express from "express";
import bodyParser from "body-parser";
import { Connection, Client } from "@temporalio/client";
import dotenv from "dotenv";
dotenv.config();

const app = express().use(bodyParser.json());
const connection = await Connection.connect();
const client = new Client({ connection });

app.post("/alarm", async (req, res) => {
  const metricName = req.body?.AlarmName ?? "UnknownMetric";
  await client.workflow.start("diagnose", {
    args: [metricName],
    taskQueue: "flowpilot",
    workflowId: `wf-${Date.now()}`
  });
  res.status(200).send("FlowPilot triggered");
});

app.listen(3000, () => console.log("🚀 FlowPilot alarm listener on http://localhost:3000"));
