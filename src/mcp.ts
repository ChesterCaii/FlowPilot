// src/mcp.ts
/**
 * Wraps an async function as an MCP tool.
 * The wrapper itself just forwards calls to the original function
 * but tags it with a tool name for MCP routing.
 */
export function withMcp<Args extends any[], R>(
  toolName: string,
  fn: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    console.log(`🔧 [MCP:${toolName}]`, args);
    return fn(...args);
  };
}
