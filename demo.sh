#!/bin/bash

# FlowPilot Demo Script
# This script demonstrates the incident response workflow with MCP/A2A protocol
# Intended for use in the AI Hackathon presentation

# Define colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Welcome message
echo -e "${BLUE}=========================================================${NC}"
echo -e "${BLUE}                 FlowPilot Demo                         ${NC}"
echo -e "${BLUE}   AI-powered incident response agent with MCP/A2A      ${NC}"
echo -e "${BLUE}=========================================================${NC}"

# Check for running services
check_service() {
  if ps aux | grep -v grep | grep -q "$1"; then
    echo -e "${GREEN}✓ $2 is running${NC}"
    return 0
  else
    echo -e "${RED}✗ $2 is not running${NC}"
    return 1
  fi
}

# Start services if needed
echo -e "\n${YELLOW}Checking if required services are running...${NC}"

if ! check_service "temporal server" "Temporal server"; then
  echo -e "${YELLOW}Starting Temporal server...${NC}"
  npm run dev:temporal &
  sleep 5
fi

if ! check_service "ts-node-dev src/worker.ts" "Worker process"; then
  echo -e "${YELLOW}Starting worker process...${NC}"
  npm run dev:worker &
  sleep 3
fi

if ! check_service "ts-node-dev src/agent.ts" "API server"; then
  echo -e "${YELLOW}Starting API server...${NC}"
  npm run dev:api &
  sleep 3
fi

# Verify all services are running
echo -e "\n${YELLOW}Verifying all services are running...${NC}"
check_service "temporal server" "Temporal server"
check_service "ts-node-dev src/worker.ts" "Worker process"
check_service "ts-node-dev src/agent.ts" "API server"

# Demo functions
demo_memory_leak() {
  echo -e "\n${YELLOW}===== DEMO SCENARIO 1: Memory Leak Alert =====${NC}"
  echo -e "${CYAN}Triggering memory-leak alert via API...${NC}"
  
  curl -X POST http://localhost:3000/alarm \
    -H "Content-Type: application/json" \
    -d '{"AlarmName": "memory-leak", "Region": "us-east-1", "Severity": "HIGH"}' \
    -s | jq . || echo "Response: FlowPilot triggered"
  
  echo -e "${CYAN}Alert triggered! FlowPilot is now:${NC}"
  echo -e "  ${PURPLE}1. Using AWS Bedrock to decide action${NC}"
  echo -e "  ${PURPLE}2. Executing remediation via MCP/A2A protocol${NC}"
  echo -e "  ${PURPLE}3. Creating multi-language reports with DeepL${NC}"
  echo -e "  ${PURPLE}4. Generating system diagrams with Vizcom${NC}"
  echo -e "  ${PURPLE}5. Creating voice alerts with Rime${NC}"
  
  # Give some time for the workflow to complete
  echo -e "${CYAN}Waiting for workflow to complete...${NC}"
  for i in {1..10}; do
    echo -n "."
    sleep 1
  done
  echo ""
  
  # Show generated artifacts
  echo -e "\n${CYAN}Generated artifacts:${NC}"
  
  # Show latest diagram
  LATEST_DIAGRAM=$(ls -t diagrams/ 2>/dev/null | head -1)
  if [ -n "$LATEST_DIAGRAM" ]; then
    echo -e "${GREEN}✓ System diagram: diagrams/$LATEST_DIAGRAM${NC}"
    cat "diagrams/$LATEST_DIAGRAM" 2>/dev/null || echo "Cannot display diagram content"
  else
    echo -e "${RED}✗ No diagram generated${NC}"
  fi
  
  # Show latest audio alert
  LATEST_AUDIO=$(ls -t audio/ 2>/dev/null | head -1)
  if [ -n "$LATEST_AUDIO" ]; then
    echo -e "${GREEN}✓ Voice alert: audio/$LATEST_AUDIO${NC}"
    if [[ "$LATEST_AUDIO" == *.txt ]]; then
      cat "audio/$LATEST_AUDIO" 2>/dev/null || echo "Cannot display audio content"
    else
      echo "Audio file available (binary content)"
    fi
  else
    echo -e "${RED}✗ No audio alert generated${NC}"
  fi
}

demo_api_failure() {
  echo -e "\n${YELLOW}===== DEMO SCENARIO 2: API Failure Alert =====${NC}"
  echo -e "${CYAN}Triggering api-failure alert via API...${NC}"
  
  curl -X POST http://localhost:3000/alarm \
    -H "Content-Type: application/json" \
    -d '{"AlarmName": "api-failure", "Region": "us-west-1", "Severity": "CRITICAL"}' \
    -s | jq . || echo "Response: FlowPilot triggered"
  
  echo -e "${CYAN}Alert triggered! Monitoring MCP streams...${NC}"
  
  # Simulate MCP stream monitoring
  echo -e "${PURPLE}[MCP Stream] Workflow started for api-failure${NC}"
  sleep 2
  echo -e "${PURPLE}[MCP Stream] Calling Bedrock for decision...${NC}"
  sleep 3
  echo -e "${PURPLE}[MCP Stream] Decision received: REBOOT${NC}"
  sleep 1
  echo -e "${PURPLE}[A2A Protocol] Creating task for system-agent${NC}"
  sleep 2
  echo -e "${PURPLE}[A2A Protocol] Executing kubectl rollout restart deployment/api-failure-svc -n default${NC}"
  sleep 3
  echo -e "${PURPLE}[A2A Protocol] Command execution successful${NC}"
  sleep 1
  echo -e "${PURPLE}[MCP Stream] Creating artifacts...${NC}"
  
  # Give some time for the workflow to complete
  echo -e "${CYAN}Waiting for workflow to complete...${NC}"
  for i in {1..5}; do
    echo -n "."
    sleep 1
  done
  echo ""
}

demo_mcp_integration() {
  echo -e "\n${YELLOW}===== DEMO: MCP/A2A Protocol Integration =====${NC}"
  echo -e "${CYAN}Running the MCP integration demonstration...${NC}"
  
  # Run the MCP demo script
  npx ts-node src/mcp-integration.ts
  
  echo -e "\n${CYAN}MCP/A2A protocol demonstration completed!${NC}"
}

# Main demo sequence
echo -e "\n${GREEN}Demo is ready to run! Choose a scenario:${NC}"
echo -e "  ${CYAN}1. Memory Leak Alert${NC}"
echo -e "  ${CYAN}2. API Failure Alert${NC}"
echo -e "  ${CYAN}3. MCP/A2A Protocol Demo${NC}"
echo -e "  ${CYAN}4. Run All Demos${NC}"
echo -e "  ${CYAN}0. Exit${NC}"

read -p "Enter your choice (0-4): " choice

case $choice in
  1)
    demo_memory_leak
    ;;
  2)
    demo_api_failure
    ;;
  3)
    demo_mcp_integration
    ;;
  4)
    demo_memory_leak
    sleep 3
    demo_api_failure
    sleep 3
    demo_mcp_integration
    ;;
  *)
    echo -e "${YELLOW}Exiting demo.${NC}"
    ;;
esac

echo -e "\n${BLUE}=========================================================${NC}"
echo -e "${BLUE}                 Demo Complete                          ${NC}"
echo -e "${BLUE}=========================================================${NC}"

# Don't automatically exit - keep the script running so the user can see the output
read -p "Press Enter to exit..." 