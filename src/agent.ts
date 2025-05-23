import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { Connection, Client } from "@temporalio/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
dotenv.config();

// Define the incident type
interface Incident {
  id: string;
  metric: string;
  severity: string;
  region: string;
  timestamp: string;
  status: string;
  decision?: string;
  result?: string;
}

// Store incidents in memory for the demo
const incidents: Incident[] = [];

// Helper function to complete incidents after a delay
function completeIncidentAfterDelay(incidentId: string, delayMs: number = 15000) {
  setTimeout(() => {
    const incident = incidents.find(inc => inc.id === incidentId);
    if (incident && incident.status === "PROCESSING") {
      // For demo purposes, choose a decision based on the incident type
      if (incident.metric === "memory-leak") {
        incident.decision = "REBOOT";
        incident.result = "Restarted worker pods and cleared memory cache";
      } else if (incident.metric === "api-failure") {
        incident.decision = "REBOOT";
        incident.result = "API service restarted successfully";
      } else {
        incident.decision = "IGNORE";
        incident.result = "False positive determined after analysis";
      }
      
      incident.status = "COMPLETED";
      console.log(`✅ Auto-completed incident ${incidentId} with decision: ${incident.decision}`);
    }
  }, delayMs);
}

async function startServer() {
  // 1. connect to Temporal
  const connection = await Connection.connect();
  const client = new Client({ connection });

  // 2. create Express app
  const app = express();
  app.use(bodyParser.json());
  
  // Serve static files
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Ensure directories exist
  const diagramsDir = path.join(__dirname, '../diagrams');
  const audioDir = path.join(__dirname, '../audio');
  
  if (!fs.existsSync(diagramsDir)) {
    fs.mkdirSync(diagramsDir, { recursive: true });
  }
  
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  
  // Serve diagram files
  app.use('/diagrams', express.static(diagramsDir));
  
  // Serve audio files
  app.use('/audio', express.static(audioDir));

  // API endpoint to trigger an alarm
  app.post("/alarm", async (req: Request, res: Response) => {
    const metricName = (req.body?.AlarmName as string) ?? "UnknownMetric";
    const severity = (req.body?.Severity as string) ?? "MEDIUM";
    const region = (req.body?.Region as string) ?? "us-east-1";
    
    const incidentId = `wf-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Store incident info
    const incident: Incident = {
      id: incidentId,
      metric: metricName,
      severity,
      region,
      timestamp,
      status: "PROCESSING"
    };
    
    incidents.push(incident);
    
    // Start workflow
    await client.workflow.start("diagnose", {
      args: [metricName],
      taskQueue: "flowpilot",
      workflowId: incidentId
    });
    
    // For demo purposes, automatically complete the incident after a delay
    completeIncidentAfterDelay(incidentId, 20000);
    
    res.status(200).json({
      message: "FlowPilot triggered",
      incidentId
    });
  });
  
  // API endpoint to get all incidents
  app.get("/api/incidents", (req: Request, res: Response) => {
    res.json(incidents);
  });
  
  // API endpoint to get incident details
  app.get("/api/incidents/:id", (req: Request, res: Response) => {
    const incident = incidents.find(inc => inc.id === req.params.id);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    // Check for related artifacts
    let diagram: string | null = null;
    let audio: string | null = null;
    
    // Find latest diagram for this incident
    if (fs.existsSync(diagramsDir)) {
      const files = fs.readdirSync(diagramsDir);
      // Look for diagrams with timestamp close to the incident time
      const matchingFiles = files.filter(file => {
        const filePath = path.join(diagramsDir, file);
        const fileStat = fs.statSync(filePath);
        // If file was created within 30 seconds of the incident
        return Math.abs(fileStat.birthtime.getTime() - new Date(incident.timestamp).getTime()) < 30000;
      });
      
      if (matchingFiles.length > 0) {
        diagram = `/diagrams/${matchingFiles[0]}`;
      }
    }
    
    // Find latest audio for this incident
    if (fs.existsSync(audioDir)) {
      const files = fs.readdirSync(audioDir);
      // Look for audio with timestamp close to the incident time
      const matchingFiles = files.filter(file => {
        const filePath = path.join(audioDir, file);
        const fileStat = fs.statSync(filePath);
        // If file was created within 30 seconds of the incident
        return Math.abs(fileStat.birthtime.getTime() - new Date(incident.timestamp).getTime()) < 30000;
      });
      
      if (matchingFiles.length > 0) {
        audio = `/audio/${matchingFiles[0]}`;
      }
    }
    
    return res.json({
      ...incident,
      artifacts: {
        diagram,
        audio
      }
    });
  });
  
  // Update incident status (would be called by the workflow in a real implementation)
  app.post("/api/incidents/:id/status", (req: Request, res: Response) => {
    const { status, decision, result } = req.body;
    const incident = incidents.find(inc => inc.id === req.params.id);
    
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    
    incident.status = status || incident.status;
    incident.decision = decision;
    incident.result = result;
    
    return res.json(incident);
  });
  
  // Force completion of all processing incidents (for demo purposes)
  app.post("/api/complete-all", (req: Request, res: Response) => {
    const processingIncidents = incidents.filter(inc => inc.status === "PROCESSING");
    
    processingIncidents.forEach(incident => {
      incident.status = "COMPLETED";
      
      if (incident.metric === "memory-leak") {
        incident.decision = "REBOOT";
        incident.result = "Restarted worker pods and cleared memory cache";
      } else if (incident.metric === "api-failure") {
        incident.decision = "REBOOT";
        incident.result = "API service restarted successfully";
      } else {
        incident.decision = "IGNORE";
        incident.result = "False positive determined after analysis";
      }
    });
    
    return res.json({
      message: `Completed ${processingIncidents.length} incidents`,
      completed: processingIncidents.map(inc => inc.id)
    });
  });
  
  // Serve the main app for any other route
  app.get('/', (req: Request, res: Response) => {
    return res.sendFile(path.join(__dirname, '../public/static-dashboard.html'));
  });
  
  // Serve the dashboard directly
  app.get('/dashboard', (req: Request, res: Response) => {
    return res.sendFile(path.join(__dirname, '../public/static-dashboard.html'));
  });
  
  // Explicit route for static dashboard
  app.get('/static-dashboard.html', (req: Request, res: Response) => {
    return res.sendFile(path.join(__dirname, '../public/static-dashboard.html'));
  });
  
  // Fallback for any other routes
  app.get('*', (req: Request, res: Response) => {
    return res.sendFile(path.join(__dirname, '../public/static-dashboard.html'));
  });

  // 3. listen
  app.listen(3000, () => console.log("🚀 FlowPilot listening on http://localhost:3000"));
}

startServer().catch(err => {
  console.error("❌ Failed to start FlowPilot API:", err);
  process.exit(1);
});
