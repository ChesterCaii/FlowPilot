import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * MCPStreamer - Implements the Machine-Centric Protocol for agent-to-agent communication
 * This enables FlowPilot to communicate with other agents in a standardized way
 * 
 * Now with Gumloop guMCP integration for the $500 prize
 */
export class MCPStreamer {
  private streamId: string;
  private serverUrl: string;
  private gumloopUrl: string;
  private streams: Map<string, any[]>;

  constructor(serverUrl: string = process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp', 
              gumloopUrl: string = process.env.GUMLOOP_URL || 'https://gumloop.com/api/gumcp') {
    this.streamId = uuidv4();
    this.serverUrl = serverUrl;
    this.gumloopUrl = gumloopUrl;
    this.streams = new Map();
    
    console.log(`🔌 MCP Streamer initialized with ID: ${this.streamId}`);
    console.log(`🔌 Gumloop guMCP integration enabled at: ${this.gumloopUrl}`);
  }

  /**
   * Creates a new stream for messaging between agents
   */
  createStream(streamName: string): string {
    const streamId = `${streamName}-${uuidv4()}`;
    this.streams.set(streamId, []);
    console.log(`🔌 MCP Stream created: ${streamId}`);
    
    // Register with Gumloop if enabled
    this._registerWithGumloop(streamId, streamName);
    
    return streamId;
  }
  
  /**
   * Register stream with Gumloop guMCP servers
   */
  private async _registerWithGumloop(streamId: string, streamName: string): Promise<void> {
    if (process.env.GUMLOOP_KEY) {
      try {
        console.log(`🔄 Registering stream ${streamId} with Gumloop guMCP servers...`);
        
        const response = await axios.post(
          `${this.gumloopUrl}/streams/register`,
          {
            streamId,
            streamName,
            agentId: 'flowpilot',
            metadata: {
              description: `FlowPilot incident stream for ${streamName}`,
              createdAt: new Date().toISOString()
            }
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.GUMLOOP_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );
        
        console.log(`✅ Successfully registered with Gumloop guMCP: ${response.status}`);
      } catch (err) {
        console.error(`❌ Failed to register with Gumloop guMCP:`, err);
      }
    }
  }

  /**
   * Publishes a message to the specified stream
   * Also sends to Gumloop guMCP servers if enabled
   */
  async publish(streamId: string, message: any): Promise<void> {
    // Add message to local stream
    const stream = this.streams.get(streamId) || [];
    const messageWithMeta = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
      id: uuidv4()
    };
    
    stream.push(messageWithMeta);
    this.streams.set(streamId, stream);
    
    console.log(`📝 MCP message published to stream ${streamId}`);
    
    // Publish to gumloop if enabled
    if (process.env.GUMLOOP_KEY) {
      try {
        console.log(`🔄 Publishing to Gumloop guMCP...`);
        
        await axios.post(
          `${this.gumloopUrl}/streams/${streamId}/publish`,
          {
            message: {
              ...messageWithMeta,
              agentId: 'flowpilot'
            }
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.GUMLOOP_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );
        
        console.log(`✅ Message published to Gumloop guMCP`);
      } catch (err) {
        console.error(`❌ Failed to publish to Gumloop guMCP:`, err);
      }
    }
  }

  /**
   * Creates an artifact in the MCP system
   */
  async createArtifact(type: string, data: any): Promise<string> {
    const artifactId = `${type}-${uuidv4()}`;
    
    console.log(`🏺 MCP Artifact created: ${artifactId}`);
    
    // Create artifact in gumloop if enabled
    if (process.env.GUMLOOP_KEY) {
      try {
        console.log(`🔄 Creating artifact in Gumloop guMCP...`);
        
        await axios.post(
          `${this.gumloopUrl}/artifacts/create`,
          {
            artifactId,
            artifactType: type,
            data,
            agentId: 'flowpilot',
            metadata: {
              createdAt: new Date().toISOString()
            }
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.GUMLOOP_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );
        
        console.log(`✅ Artifact created in Gumloop guMCP`);
      } catch (err) {
        console.error(`❌ Failed to create artifact in Gumloop guMCP:`, err);
      }
    }
    
    return artifactId;
  }

  /**
   * Notifies another agent using A2A protocol
   */
  async notifyAgent(agentId: string, action: any): Promise<void> {
    const streamId = this.createStream(`a2a-${agentId}`);
    
    const a2aMessage = {
      type: 'A2A_NOTIFICATION',
      sender: 'flowpilot',
      recipient: agentId,
      action,
      metadata: {
        mcpStreamId: streamId
      }
    };
    
    await this.publish(streamId, a2aMessage);
    console.log(`🔄 A2A Notification sent to ${agentId}`);
  }

  /**
   * Gets all messages from a stream
   */
  getStreamMessages(streamId: string): any[] {
    return this.streams.get(streamId) || [];
  }
}

// Singleton instance for use throughout the application
export const mcpStreamer = new MCPStreamer();

/**
 * Agent-to-Agent (A2A) Notifier Helper
 */
export class A2ANotifier {
  private streamer: MCPStreamer;
  
  constructor(streamer: MCPStreamer = mcpStreamer) {
    this.streamer = streamer;
  }
  
  async notifySystemAgent(command: string): Promise<void> {
    await this.streamer.notifyAgent('system-agent', { command });
    console.log(`📢 System agent notified to execute: ${command}`);
  }
  
  async notifyAlertAgent(message: string, severity: string): Promise<void> {
    await this.streamer.notifyAgent('alert-agent', { message, severity });
    console.log(`📢 Alert agent notified with message: ${message}`);
  }
  
  /**
   * Create a task to be executed by one or more agents
   */
  static async createTask(options: {
    type: string;
    agents: string[];
    data?: any;
  }): Promise<TaskHelper> {
    const taskId = uuidv4();
    console.log(`🤝 A2A Task created: ${taskId} (${options.type})`);
    
    return new TaskHelper(taskId, options);
  }
}

// Export A2A notifier instance
export const a2aNotifier = new A2ANotifier();

/**
 * Represents an A2A task for inter-agent communication
 */
class TaskHelper {
  private id: string;
  private options: any;
  
  constructor(id: string, options: any) {
    this.id = id;
    this.options = options;
  }
  
  async sendMessage(message: any): Promise<void> {
    for (const agent of this.options.agents) {
      await mcpStreamer.notifyAgent(agent, {
        taskId: this.id,
        ...message
      });
    }
  }
  
  async complete(result: any): Promise<void> {
    console.log(`✅ A2A Task ${this.id} completed:`, JSON.stringify(result, null, 2));
    
    // In a real implementation, we'd notify all agents
    for (const agent of this.options.agents) {
      await mcpStreamer.notifyAgent(agent, {
        taskId: this.id,
        type: 'TASK_COMPLETED',
        result
      });
    }
  }
} 