import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

// Detect OS for playing audio
const OS_TYPE = process.platform;

// Voice queue to prevent overlapping
const voiceQueue: Array<() => Promise<any>> = [];
let isProcessing = false;
const MIN_SILENCE_BETWEEN_VOICES = 3000; // 3 seconds minimum delay between voices

/**
 * Process the voice queue one at a time
 */
async function processVoiceQueue() {
  if (isProcessing || voiceQueue.length === 0) return;
  
  isProcessing = true;
  try {
    const nextVoice = voiceQueue.shift();
    if (nextVoice) {
      await nextVoice();
      
      // Enforce minimum silence between voices
      await new Promise(resolve => setTimeout(resolve, MIN_SILENCE_BETWEEN_VOICES));
    }
  } catch (err) {
    console.error('Error processing voice queue:', err);
  } finally {
    isProcessing = false;
    if (voiceQueue.length > 0) {
      // Add a small delay before processing next voice
      await new Promise(resolve => setTimeout(resolve, 500));
      processVoiceQueue();
    }
  }
}

/**
 * Add speech task to the queue
 */
function queueSpeech(task: () => Promise<any>) {
  voiceQueue.push(task);
  
  // If not currently processing, start the queue
  if (!isProcessing) {
    processVoiceQueue();
  }
}

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
    male: ["orion"],
    female: ["rachel", "luna", "celeste"]
  },
  mistv2: {
    male: ["james"],
    female: ["jennifer"]
  }
};

/**
 * Clean text for voice by removing symbols, numbers, etc. that cause issues
 */
function sanitizeTextForVoice(text: string): string {
  // Remove any equals signs, dashes, technical symbols
  let cleaned = text.replace(/[=\-\[\]\/\\{}()*+?.,^$|#]/g, ' ');
  
  // Remove any long numeric sequences
  cleaned = cleaned.replace(/\d{3,}/g, '');
  
  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Speaks text using text-to-speech, either via Rime API or fallback to system voice
 * Now uses a queue system to prevent overlapping
 */
export async function speak(text: string, useRime: boolean = true, voice: string = "rachel", model: string = "arcana"): Promise<string | null> {
  // Sanitize text to prevent voice issues
  const cleanText = sanitizeTextForVoice(text);
  
  // Create a task to be added to the queue
  const speechTask = async (): Promise<string | null> => {
    console.log(`🔊 Speaking: "${cleanText.substring(0, 30)}${cleanText.length > 30 ? '...' : ''}"`);
    
    // Create audio directory if it doesn't exist
    const audioDir = path.join(process.cwd(), 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    try {
      if (useRime && process.env.RIME_KEY) {
        // Use Rime API to generate speech
        console.log(`Using Rime API with voice: ${voice}`);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `rime-${timestamp}.mp3`;
        const filePath = path.join(audioDir, filename);
        
        try {
          // Proper Rime TTS API endpoint - use sanitized text
          const response = await axios.post(
            "https://users.rime.ai/v1/rime-tts",
            {
              text: cleanText,
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
          
          // Play the audio
          await playAudioFile(filePath);
          
          return filePath;
        } catch (err: any) {
          console.error(`Error with Rime API: ${err.message}`);
          
          // Try fallback to system voice
          return speak(cleanText, false);
        }
      } else {
        // Fallback to system text-to-speech
        console.log("Using system text-to-speech fallback...");
        
        // Create a simple script to use system TTS
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const scriptFile = path.join(audioDir, `tts-script-${timestamp}.txt`);
        fs.writeFileSync(scriptFile, cleanText);
        
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
              $synthesizer.SpeakAsync("${cleanText.replace(/"/g, '\\"')}");
              Start-Sleep -s 2; # Allow time for speaking to complete`
            );
            command = `powershell -File "${psScript}"`;
            break;
          case 'linux': // Linux with espeak
            command = `espeak "${cleanText.replace(/"/g, '\\"')}"`;
            break;
          default:
            console.log(`Unsupported OS: ${OS_TYPE} for text-to-speech`);
            return null;
        }
        
        // Execute the TTS command
        await new Promise<void>((resolve) => {
          exec(command, () => {
            resolve();
          });
        });
        
        return scriptFile;
      }
    } catch (err: any) {
      console.error("Voice generation failed:", err.message);
      return null;
    }
  };
  
  // Add to queue and return promise
  return new Promise((resolve) => {
    queueSpeech(async () => {
      const result = await speechTask();
      resolve(result);
    });
  });
}

/**
 * Create a demo voice narration for important steps
 * Simplified text to prevent slow reading
 */
export async function narrateDemo(step: string): Promise<void> {
  let narrateText = "";
  
  switch (step) {
    case "start":
      narrateText = "Welcome to FlowPilot. This system automatically responds to incidents.";
      break;
    case "memory-leak":
      narrateText = "Memory leak detected. Starting incident response.";
      break;
    case "api-failure":
      narrateText = "API failure detected. Initiating remediation workflow.";
      break;
    case "mcp":
      narrateText = "Demonstrating agent to agent communication via MCP protocol.";
      break;
    case "bedrock-deciding":
      narrateText = "Analyzing incident data to determine appropriate action.";
      break;
    case "reboot-decision":
      narrateText = "Decision made. Service will be rebooted to resolve the issue.";
      break;
    case "ignore-decision":
      narrateText = "Analysis complete. This alert can be safely ignored.";
      break;
    case "completion":
      narrateText = "Incident response completed successfully. Services restored.";
      break;
    default:
      narrateText = step; // If no predefined text, just speak the provided text
  }
  
  await speak(narrateText, true, "rachel", "arcana");
} 