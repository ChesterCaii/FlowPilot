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

# Add Rime key check
if grep -q "RIME_KEY" .env && ! grep -q "RIME_KEY=sk_rime_your_api_key_here" .env; then
  echo -e "${GREEN}✓ Rime API key is configured in .env${NC}"
else
  echo -e "${RED}✗ Rime API key is not properly configured in .env${NC}"
  echo -e "${YELLOW}Please add your Rime API key to .env file:${NC}"
  echo -e "${YELLOW}RIME_KEY=your_actual_key_here${NC}"
fi

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
  sleep 5
fi

# Give extra time for API server to fully initialize
sleep 5

# Verify all services are running
echo -e "\n${YELLOW}Verifying all services are running...${NC}"
check_service "temporal server" "Temporal server"
check_service "ts-node-dev src/worker.ts" "Worker process"
check_service "ts-node-dev src/agent.ts" "API server"

# Clear terminal before showing menu
clear

# Open the Web UI
open_web_ui() {
  echo -e "\n${CYAN}Opening FlowPilot Web UI...${NC}"
  
  # Force clear browser cache for FlowPilot dashboard
  echo -e "${YELLOW}Ensuring fresh dashboard load...${NC}"
  
  # First open FlowPilot dashboard directly
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - open with cache clearing flags
    open -a "Safari" "http://localhost:3000/static-dashboard.html"
    sleep 2
    # Then open Temporal UI in a separate tab
    open "http://localhost:8233"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "http://localhost:3000/static-dashboard.html" &> /dev/null
    sleep 2
    xdg-open "http://localhost:8233" &> /dev/null
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    start "http://localhost:3000/static-dashboard.html"
    sleep 2
    start "http://localhost:8233"
  else
    echo -e "${YELLOW}Please open http://localhost:3000/static-dashboard.html in your browser${NC}"
    echo -e "${YELLOW}Also open http://localhost:8233 to view Temporal UI${NC}"
  fi
}

# Demo functions
demo_memory_leak() {
  clear
  echo -e "\n${YELLOW}===== DEMO SCENARIO 1: Memory Leak Alert =====${NC}"
  echo -e "\n${CYAN}• Starting voice narration...${NC}"
  
  # Use voice narration with consistent voice
  npx ts-node -e "require('./src/utils/rime').narrateDemo('memory-leak')"
  
  # Wait extra time after speech
  sleep 5
  
  echo -e "\n${CYAN}• Triggering memory-leak alert via API...${NC}"
  
  curl -X POST http://localhost:3000/alarm \
    -H "Content-Type: application/json" \
    -d '{"AlarmName": "memory-leak", "Region": "us-east-1", "Severity": "HIGH"}' \
    -s | jq . || echo "Response: FlowPilot triggered"
  
  # Long pause to allow notifications to finish
  sleep 8
  
  echo -e "\n${CYAN}• Alert triggered! FlowPilot is now:${NC}"
  echo -e "  ${PURPLE}1. Using AWS Bedrock to decide action${NC}"
  sleep 3
  
  # Skip the bedrock narration to prevent overlap with alert
  echo -e "\n${CYAN}• Bedrock decision in progress...${NC}"
  sleep 5
  
  echo -e "\n${CYAN}• Executing remediation:${NC}"
  echo -e "  ${PURPLE}→ Restarting worker pods via MCP/A2A protocol${NC}"
  sleep 3
  echo -e "  ${PURPLE}→ Creating reports with DeepL translations${NC}"
  sleep 3
  echo -e "  ${PURPLE}→ Generating system diagrams${NC}"
  sleep 3
  echo -e "  ${PURPLE}→ Creating voice alerts with Rime${NC}"
  
  # Very long wait for all notifications to complete
  echo -e "\n${CYAN}• Waiting for workflow to complete...${NC}"
  for i in {1..12}; do
    echo -n "."
    sleep 1
  done
  echo ""
  
  # Skip completion narration to avoid overlap
  echo -e "\n${CYAN}• Incident resolved successfully!${NC}"
  sleep 5
  
  # Show generated artifacts
  echo -e "\n${CYAN}• Generated artifacts:${NC}"
  
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
  
  echo -e "${CYAN}Check the web UI to see the incident details!${NC}"
  sleep 2
}

demo_api_failure() {
  clear
  echo -e "\n${YELLOW}===== DEMO SCENARIO 2: API Failure Alert =====${NC}"
  echo -e "\n${CYAN}• Starting voice narration...${NC}"
  
  # Use voice narration with consistent voice
  npx ts-node -e "require('./src/utils/rime').narrateDemo('api-failure')"
  
  # Wait extra time after speech
  sleep 5
  
  echo -e "\n${CYAN}• Triggering api-failure alert via API...${NC}"
  
  curl -X POST http://localhost:3000/alarm \
    -H "Content-Type: application/json" \
    -d '{"AlarmName": "api-failure", "Region": "us-west-1", "Severity": "CRITICAL"}' \
    -s | jq . || echo "Response: FlowPilot triggered"
  
  # Long pause to allow notifications to finish
  sleep 8
  
  echo -e "\n${CYAN}• Alert triggered! Monitoring MCP streams...${NC}"
  
  # Simulate MCP stream monitoring
  echo -e "  ${PURPLE}→ Workflow started for api-failure${NC}"
  sleep 3
  echo -e "  ${PURPLE}→ Calling Bedrock for decision...${NC}"
  sleep 3
  
  # Skip the bedrock narration to prevent overlap with alert
  echo -e "\n${CYAN}• Bedrock decision in progress...${NC}"
  sleep 5
  
  # Skip reboot decision narration
  echo -e "\n${CYAN}• Decision received: REBOOT${NC}"
  sleep 5
  
  echo -e "\n${CYAN}• Executing remediation:${NC}"
  echo -e "  ${PURPLE}→ Creating task for system-agent${NC}"
  sleep 3
  echo -e "  ${PURPLE}→ Executing: kubectl rollout restart deployment/api-failure-svc -n default${NC}"
  sleep 3
  echo -e "  ${PURPLE}→ Command execution successful${NC}"
  sleep 3
  echo -e "  ${PURPLE}→ Creating artifacts...${NC}"
  
  # Very long wait for all notifications to complete
  echo -e "\n${CYAN}• Waiting for workflow to complete...${NC}"
  for i in {1..12}; do
    echo -n "."
    sleep 1
  done
  echo ""
  
  # Skip completion narration to avoid overlap
  echo -e "\n${CYAN}• Incident resolved successfully!${NC}"
  sleep 5
  
  echo -e "\n${CYAN}• Check the web UI to see the incident details!${NC}"
}

demo_mcp_integration() {
  clear
  echo -e "\n${YELLOW}===== DEMO: MCP/A2A Protocol Integration =====${NC}"
  echo -e "\n${CYAN}• Starting voice narration...${NC}"
  
  # Use voice narration with consistent voice
  npx ts-node -e "require('./src/utils/rime').narrateDemo('mcp')"
  
  # Wait extra time after speech
  sleep 5
  
  echo -e "\n${CYAN}• Running the MCP integration demonstration...${NC}"
  
  # Run the MCP demo script
  npx ts-node src/mcp-integration.ts
  
  echo -e "\n${CYAN}• MCP/A2A protocol demonstration completed!${NC}"
}

# Main demo sequence
echo -e "\n${GREEN}Demo is ready to run! Choose a scenario:${NC}"
echo -e "  ${CYAN}1. Launch Web UI${NC}"
echo -e "  ${CYAN}2. Memory Leak Alert${NC}"
echo -e "  ${CYAN}3. API Failure Alert${NC}"
echo -e "  ${CYAN}4. MCP/A2A Protocol Demo${NC}"
echo -e "  ${CYAN}5. Run Full Demo (Web UI + All Scenarios)${NC}"
echo -e "  ${CYAN}0. Exit${NC}"

# Ensure we wait for input on a clean line
echo ""
echo -e "${YELLOW}FlowPilot is waiting for your selection...${NC}"
read -p "Enter your choice (0-5): " choice

# Wait for user input before proceeding
sleep 1

# Clear any buffered input
read -t 0.1 -n 1000 discard || true

case $choice in
  1)
    open_web_ui
    ;;
  2)
    demo_memory_leak
    ;;
  3)
    demo_api_failure
    ;;
  4)
    demo_mcp_integration
    ;;
  5)
    # Welcome narration
    clear
    echo -e "\n${YELLOW}===== Complete FlowPilot Demo =====${NC}"
    echo -e "\n${CYAN}• Starting welcome narration...${NC}"
    npx ts-node -e "require('./src/utils/rime').narrateDemo('start')"
    
    # Wait extra time after speech
    sleep 5
    
    open_web_ui
    sleep 15 # Increased delay
    demo_memory_leak
    sleep 20 # Much longer delay between demos
    demo_api_failure
    sleep 20 # Much longer delay between demos
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