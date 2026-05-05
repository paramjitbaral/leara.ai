export type AgentToolName =
  | "file_read"
  | "file_write"
  | "file_edit"
  | "terminal_execute"
  | "search_codebase"
  | "list_files";

export interface AgentToolCall {
  name: AgentToolName;
  args: Record<string, any>;
}

export interface AgentDecision {
  thought: string;
  action:
  | {
    type: "tool";
    tool: AgentToolCall;
  }
  | {
    type: "finish";
    summary: string;
  };
}

export interface AgentLoopLog {
  iteration: number;
  thought: string;
  tool?: AgentToolCall;
  status: "ok" | "error" | "finish";
  output: string;
}

export interface AgentRunRequest {
  task: string;
  context?: Record<string, any>;
  workspaceRoot: string;
  userId?: string;
  folder?: string;
  maxIterations?: number;
  provider: "gemini" | "openai" | "ollama" | "custom";
  apiKey?: string;
  model?: string;
  endpoint?: string;
  systemInstruction?: string;
  history?: AgentLoopLog[];
  initialSteps?: string[];
  interactive?: boolean;
}

export interface AgentRunResult {
  success: boolean;
  completed: boolean;
  iterations: number;
  summary: string;
  logs: AgentLoopLog[];
  touchedFiles: string[];
}
