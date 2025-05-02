# FlowPilot

An AI-powered incident response agent that automates on-call duties using AWS Bedrock, Temporal, and sponsor integrations.

## Overview

FlowPilot is a SaaS agent that "stands in" for your on-call engineer. It:

1. **Senses** CloudWatch alarms via webhook
2. **Reasons** via AWS Bedrock (Claude or Titan)
3. **Executes** remediation actions (pod restarts via kubectl or Block/Goose)
4. **Communicates** with multi-language reports (DeepL), diagrams (Vizcom), and voice alerts (Rime)

Built on Temporal for durable workflows and wrapped in MCP so the LLM can directly call out to sponsor tools.

## Key Features

- 🧠 **AI-Driven Decision Making**: Uses AWS Bedrock (Claude 3 Sonnet or Titan) to decide whether to reboot or ignore alerts
- 🔄 **Automated Remediation**: Executes kubernetes commands to restart failing services
- 🌎 **Multi-Language Reports**: Automatically translates incident reports to French and German using DeepL
- 📊 **Visual Incident Diagrams**: Generates system diagrams of affected components using Vizcom
- 🔊 **Voice Alerts**: Converts incident reports to voice alerts using Rime
- 📈 **Evaluation Metrics**: Logs decision quality to Arize for continuous improvement
- ⏱️ **Durable Workflows**: Built on Temporal to ensure reliable execution even during failures

## Sponsor Integrations

- **Temporal**: Core workflow orchestration with durable execution and retries
- **AWS Bedrock**: AI decisioning using Claude 3 Sonnet or Titan models
- **DeepL**: Multi-language translation of incident reports
- **Block/Goose**: Secure command execution (simulated in development)
- **Vizcom**: Diagram generation for visual incident representation
- **Rime**: Voice alert generation for audible notifications
- **Arize**: Evaluation metrics for AI decision quality

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Temporal server (local dev or cloud)
- AWS account with Bedrock access
- Sponsor API keys (see .env configuration)

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/flowpilot.git
cd flowpilot
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file based on required variables:
```env
# AWS Bedrock Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# DeepL API for multi-language translation
DEEPL_API_KEY=your_deepl_api_key

# Vizcom for system diagrams
VIZCOM_KEY=your_vizcom_api_key

# Rime for voice alerts
RIME_KEY=your_rime_api_key

# Arize for evaluation metrics
ARIZE_KEY=your_arize_api_key

# Block/Goose (if using)
BLOCK_GOOSE_API_KEY=your_goose_api_key
```

### Running the Application

1. Start Temporal server (in a separate terminal)
```bash
npm run dev:temporal
```

2. Start the worker (in a separate terminal)
```bash
npm run dev:worker
```

3. Start the API server (in a separate terminal)
```bash
npm run dev:api
```

4. Trigger a test incident
```bash
curl -X POST http://localhost:3000/alarm -H "Content-Type: application/json" -d '{"AlarmName": "high-cpu-usage"}'
```

## Testing

To test FlowPilot without external dependencies, you can:

1. Use the test script
```bash
npm run test
```

2. Or directly call the workflow
```bash
npx ts-node src/test.ts
```

## Demo Scenarios

For hackathon demonstrations, we've prepared several scenarios:

1. **High CPU Usage**: Simulates a service with excessive CPU consumption
2. **Memory Leak**: Demonstrates the system detecting and remedying a memory leak
3. **Database Connection Failure**: Shows how the system handles connectivity issues

## Project Structure

- `/src` - Main source code
  - `/activities.ts` - Core activities with sponsor integrations
  - `/agent.ts` - Express API for receiving alerts
  - `/worker.ts` - Temporal worker configuration
  - `/mcp.ts` - MCP wrapper for activities
  - `/workflows/diagnose.ts` - Main workflow definition
- `/diagrams` - Generated system visualizations (created at runtime)
- `/audio` - Generated voice alerts (created at runtime)

## Hackathon Information

This project was created for the AI Agents Hackathon. It targets multiple sponsor prizes:

- Temporal ($2,000): Core workflow orchestration
- Vizcom ($3,000): Visual intelligence for incident diagrams
- Rime ($2,000): Voice alerts for incidents
- DeepL ($1,000-1,500): Multi-language translation
- Block/Goose ($1,000): Secure command execution
- Arize ($500): Evaluation metrics for AI decisions

## License

MIT 