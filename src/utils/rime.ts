import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

// Detect OS for playing audio
const OS_TYPE = process.platform;

/**
 * Plays audio file using appropriate command for the OS
 */
function playAudioFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let command: string;
    
    switch (OS_TYPE) {
      case 'darwin': // macOS
        command = `afplay "${filePath}"`;
        break;
      case 'win32': // Windows
        command = `powershell -c (New-Object Media.SoundPlayer "${filePath}").PlaySync()`;
        break;
      case 'linux': // Linux
        command = `aplay "${filePath}"`;
        break;
      default:
        console.log(`Unsupported OS: ${OS_TYPE}, can't play audio automatically`);
        resolve();
        return;
    }
    
    exec(command, (error) => {
      if (error) {
        console.error('Error playing audio:', error);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get available voice options for Rime models
 */
export const rimeVoices = {
  arcana: {
    male: ["orion", "ursa"],
    female: ["luna", "celeste", "astra", "esther", "estelle", "andromeda"]
  },
  mistv2: {
    male: ["james", "mike", "matthew"],
    female: ["jennifer", "sue", "karen"]
  }
};

/**
 * Speaks text using text-to-speech, either via Rime API or fallback to system voice
 */
export async function speak(text: string, useRime: boolean = true, voice: string = "orion", model: string = "arcana"): Promise<string | null> {
  console.log(`🔊 Speaking: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  
  // Create audio directory if it doesn't exist
  const audioDir = path.join(process.cwd(), 'audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  
  try {
    if (useRime && process.env.RIME_KEY) {
      // Use Rime API to generate speech
      console.log(`Using Rime API ${model} model with voice: ${voice}...`);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `rime-${timestamp}.mp3`;
      const filePath = path.join(audioDir, filename);
      
      try {
        // Using the Arcana or Mist v2 endpoint based on model parameter
        console.log(`Attempting to use Rime API ${model} endpoint`);
        
        // Proper Rime TTS API endpoint
        const response = await axios.post(
          "https://users.rime.ai/v1/rime-tts",
          {
            text: text,
            speaker: voice,
            modelId: model
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.RIME_KEY}`,
              "Content-Type": "application/json", 
              "Accept": "audio/mp3"
            },
            responseType: 'arraybuffer'
          }
        );
        
        // Save the audio file
        fs.writeFileSync(filePath, response.data);
        console.log(`✅ Rime voice saved to ${filePath}`);
        
        // Play the audio
        await playAudioFile(filePath);
        
        return filePath;
      } catch (err: any) {
        console.error(`❌ Error with Rime ${model} endpoint: ${err.message}`);
        
        // Try fallback to older Rime API if available
        try {
          console.log("Attempting to use Rime fallback API endpoint");
          
          const response = await axios.post(
            "https://api.rime.ai/v1/audio/speech/synthesize",
            {
              text: text,
              voice: voice
            },
            {
              headers: {
                "Authorization": `Bearer ${process.env.RIME_KEY}`,
                "Content-Type": "application/json"
              },
              responseType: 'arraybuffer'
            }
          );
          
          // Save the audio file
          fs.writeFileSync(filePath, response.data);
          console.log(`✅ Rime voice saved to ${filePath}`);
          
          // Play the audio
          await playAudioFile(filePath);
          
          return filePath;
        } catch (altErr: any) {
          console.error(`❌ Error with fallback Rime endpoint: ${altErr.message}`);
          throw new Error(`Failed to generate speech with Rime endpoints: ${err.message}, ${altErr.message}`);
        }
      }
    } else {
      // Fallback to system text-to-speech
      console.log("Using system text-to-speech fallback...");
      
      // Create a simple script to use system TTS
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scriptFile = path.join(audioDir, `tts-script-${timestamp}.txt`);
      fs.writeFileSync(scriptFile, text);
      
      let command: string;
      switch (OS_TYPE) {
        case 'darwin': // macOS
          command = `say -f "${scriptFile}"`;
          break;
        case 'win32': // Windows
          // Create and execute a PowerShell script for speech
          const psScript = path.join(audioDir, `tts-script-${timestamp}.ps1`);
          fs.writeFileSync(
            psScript,
            `Add-Type -AssemblyName System.Speech; 
            $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer;
            $synthesizer.SpeakAsync("${text.replace(/"/g, '\\"')}");
            Start-Sleep -s 2; # Allow time for speaking to complete`
          );
          command = `powershell -File "${psScript}"`;
          break;
        case 'linux': // Linux with espeak
          command = `espeak "${text.replace(/"/g, '\\"')}"`;
          break;
        default:
          console.log(`Unsupported OS: ${OS_TYPE} for text-to-speech`);
          return null;
      }
      
      // Execute the TTS command
      exec(command, (error) => {
        if (error) {
          console.error('Error with system TTS:', error);
        }
      });
      
      return scriptFile;
    }
  } catch (err: any) {
    console.error("❌ Voice generation failed:", err.message);
    if (err.response) {
      console.error("Response status:", err.response.status);
    }
    
    // Create fallback text file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fallbackFile = path.join(audioDir, `fallback-${timestamp}.txt`);
    fs.writeFileSync(fallbackFile, text);
    
    // Try system speech if Rime failed
    if (useRime) {
      console.log("Falling back to system speech...");
      return speak(text, false);
    }
    
    return fallbackFile;
  }
}

/**
 * Create a demo voice narration for important steps
 */
export async function narrateDemo(step: string, voiceType: string = "orion"): Promise<void> {
  let narrateText = "";
  
  switch (step) {
    case "start":
      narrateText = "Welcome to FlowPilot, your AI-powered incident response system. Today we'll demonstrate how it autonomously handles system alerts.";
      break;
    case "memory-leak":
      narrateText = "Memory leak detected in production services. Starting incident analysis and remediation workflow.";
      break;
    case "api-failure":
      narrateText = "Critical API failure detected in region us-west-1. Initiating remediation workflow with high priority.";
      break;
    case "mcp":
      narrateText = "Demonstrating MCP and A2A protocol for agent to agent communication. This enables FlowPilot to collaborate with other specialized agents.";
      break;
    case "bedrock-deciding":
      narrateText = "Using AWS Bedrock to analyze the incident data and determine the optimal course of action.";
      break;
    case "reboot-decision":
      narrateText = "Decision made: The affected service will be rebooted to resolve the issue. Preparing secure remediation process.";
      break;
    case "ignore-decision":
      narrateText = "Analysis complete. This alert can be safely ignored based on our comprehensive evaluation.";
      break;
    case "completion":
      narrateText = "Incident response completed successfully. All services have been restored to normal operation. Response time: 4.3 seconds.";
      break;
    default:
      narrateText = step; // If no predefined text, just speak the provided text
  }
  
  await speak(narrateText, true, voiceType, "arcana");
} 