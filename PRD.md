# FlowPilot PRD

## 1. Overview & Purpose
FlowPilot is a SaaS agent that “stands in” for your on-call engineer: it senses CloudWatch alarms, reasons via an LLM (Claude or Titan), executes remediation (pod restarts via kubectl or Block/Goose), and then auto-generates multi-language post-mortems. It’s built on Temporal for durable workflows and wrapped in MCP so the LLM can call out to sponsor tools directly.

### Goals
- Automate first-line incident handling with AI-driven decisioning  
- Showcase deep integration of sponsor APIs (Temporal, DeepL, Block/Goose, Arize, Apify, etc.)  
- Deliver a polished 3-minute live demo plus code & infra ready for production  

## 2. Audience & Stakeholders
- Hackathon judges (Technical leads from AWS, Temporal, DeepL, etc.)  
- Enterprise DevOps teams evaluating AI-powered SRE solutions  
- Investors looking for scalable AI orchestration platforms  
- You (solo builder aiming to win top prizes and get hired)  

## 3. Key Features
1. **Alarm Ingestion**  
   - HTTP webhook endpoint (`POST /alarm`) triggered by CloudWatch or `curl`  
2. **LLM-Driven Decision**  
   - `decideAction(metricName)` calls Bedrock (Claude or Titan) with dynamic prompt  
3. **Automated Remediation**  
   - `executeCommand(command)` via Block/Goose or local `kubectl` simulation  
4. **Multi-Language Summary**  
   - `summarize(report)` using DeepL → returns English, French, German  
5. **Sponsor Extensions (MCP)**  
   - **Arize**: log decision vs. actual outcome  
   - **Apify**: fetch external context (e.g., status pages, incident threads)  
   - **Vizcom** (stretch): diagram component-state snapshot  
6. **Durable Orchestration**  
   - Built on Temporal with retries, persistence, recoverability  
7. **Optional React Dashboard** (stretch)  
   - Lovable UI polling SSE for real-time incident status cards  

## 4. User Stories
| ID  | As a…         | I want to…                                     | So that…                                         |
|-----|---------------|------------------------------------------------|--------------------------------------------------|
| US1 | DevOps lead   | receive auto-triggered remediation on alerts   | my team can sleep through minor incidents        |
| US2 | SRE engineer  | see AI’s reasoning & action in multiple langs | I can review and understand post-mortem globally |
| US3 | CTO           | demonstrate in 3-min that AI can run on-call   | we can reduce human toil and scale response      |
| US4 | Judge         | see clear integration of sponsor APIs          | I can award prizes to best use of each tool      |

## 5. Functional Requirements
- **Webhook Endpoint**  
  - `POST /alarm` expects `{ AlarmName: string }` → returns `200 OK`  
- **Workflow Orchestration**  
  - Temporal workflow `diagnose(metricName)`  
- **decideAction Activity**  
  - Reads `BEDROCK_MODEL_ID`, builds prompt, invokes LLM, returns `"REBOOT"` or `"IGNORE"`  
- **executeCommand Activity**  
  - Accepts shell command, simulates or runs it, returns stdout or simulation text  
- **summarize Activity**  
  - Calls DeepL API, returns array `[ { lang, text } ]` for EN, FR, DE  
- **Arize Logging Activity**  
  - `POST` decision data to Arize endpoint with API key header  
- **Apify Fetch Activity**  
  - Invoke configured Apify actor to retrieve incident context  

## 6. Non-Functional Requirements
- **Reliability**: Workflow state survives restarts & can retry on failure  
- **Performance**: Complete end-to-end flow within 30s for demo  
- **Security**: All API keys in `.env`, never committed; HTTPS for webhook  
- **Scalability**: Temporal task queue can handle multiple concurrent incidents  
- **Usability**: Clear console logs; optional React dashboard for judges  
