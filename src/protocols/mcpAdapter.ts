import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * MCPStreamer - Implements the Machine-Centric Protocol for agent-to-agent communication
 * This enables FlowPilot to communicate with other agents in a standardized way
 */
export class MCPStreamer {
  private streamId: string;
  private serverUrl: string;
  private streams: Map<string, any[]>;

  constructor(serverUrl: string = process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp') {
    this.streamId = uuidv4();
    this.serverUrl = serverUrl;
    this.streams = new Map();
    
    console.log(`🔌 MCP Streamer initialized with ID: ${this.streamId}`);
  }

  /**
   * Creates a new stream for messaging between agents
   */
  createStream(streamName: string): string {
    const streamId = `${streamName}-${uuidv4()}`;
    this.streams.set(streamId, []);
    console.log(`🔌 MCP Stream created: ${streamId}`);
    return streamId;
  }

  /**
   * Publishes a message to an MCP stream
   */
  async publish(streamId: string, message: any): Promise<void> {
    const stream = this.streams.get(streamId) || [];
    
    const mcpMessage = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      data: message,
      schema: 'flowpilot-v1'
    };
    
    stream.push(mcpMessage);
    this.streams.set(streamId, stream);
    
    console.log(`🔌 MCP Message published to stream ${streamId}:`, JSON.stringify(mcpMessage, null, 2));
    
    // In a real implementation, we'd send this to an MCP server
    // For demo purposes, we'll just log it
    
    try {
      // Attempt to publish to MCP server if URL exists, otherwise just log
      if (this.serverUrl && this.serverUrl !== 'http://localhost:3001/mcp') {
        await axios.post(`${this.serverUrl}/publish`, {
          streamId,
          message: mcpMessage
        });
      }
    } catch (err) {
      console.log(`⚠️ Failed to publish to MCP server: ${err}`);
    }
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
   * Creates an artifact in the MCP stream
   */
  async createArtifact(artifactType: string, content: any): Promise<string> {
    const artifactId = `artifact-${uuidv4()}`;
    const streamId = this.createStream(`artifacts-${artifactType}`);
    
    const artifact = {
      id: artifactId,
      type: artifactType,
      content,
      created: new Date().toISOString()
    };
    
    await this.publish(streamId, {
      type: 'ARTIFACT_CREATED',
      artifact
    });
    
    console.log(`🏺 MCP Artifact created: ${artifactId} (${artifactType})`);
    return artifactId;
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
 * A2A Notifier - Helper for agent-to-agent communication
 */
export class A2ANotifier {
  static async createTask(options: {
    type: string;
    agents: string[];
    data?: any;
  }): Promise<A2ATask> {
    const taskId = uuidv4();
    console.log(`🤝 A2A Task created: ${taskId} (${options.type})`);
    
    return new A2ATask(taskId, options);
  }
}

/**
 * Represents an A2A task for inter-agent communication
 */
class A2ATask {
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