import { executeToolCall } from "./tools";
import { AgentToolCall } from "./types";

/**
 * The Executor is responsible for dispatching tool calls to the underlying system.
 * It abstracts the complexity of workspace paths and environment context.
 */
export async function executeStep(toolCall: AgentToolCall, context: { workspaceRoot: string; userId?: string; folder?: string }) {
  // Normalize context for tool execution
  const toolCtx = {
    workspaceRoot: context.workspaceRoot,
    userId: context.userId || "local-user",
    folder: context.folder
  };

  try {
    return await executeToolCall(toolCall, toolCtx);
  } catch (err: any) {
    return {
      ok: false,
      output: `Tool execution error: ${err.message}`
    };
  }
}
