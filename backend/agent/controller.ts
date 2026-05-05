// v1.1.0 - AI Agent Refactor
import { planTask } from "./planner";
import { executeToolCall, AGENT_TOOLS_METADATA } from "./tools";
import { analyzeOutput } from "./observer";
import { AgentMemory } from "./memory";
import { callAgentModel, parseDecision } from "./llm";
import { AgentRunRequest, AgentRunResult, AgentToolCall, AgentDecision } from "./types";

const MAX_ITERATIONS = 30;

export async function runAutonomousAgent(input: AgentRunRequest): Promise<AgentRunResult> {
  const memory = new AgentMemory();
  const logs: AgentRunResult["logs"] = input.history || [];
  
  // Re-populate memory from history if resuming
  if (input.history) {
    input.history.forEach(l => {
      if (l.status === "error") memory.addError(l.output);
    });
  }

  // 1. Initial Planning (Inspired by VS Code 'Task Definition')
  let currentTask = input.task;
  let steps = input.initialSteps || await planTask({
    task: currentTask,
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    endpoint: input.endpoint,
  });

  // Brief pause to stabilize API rate limits if starting fresh
  if (!input.history) {
    await new Promise(r => setTimeout(r, 1000));
  }

  const systemInstruction = `You are Leara, an autonomous AI Terminal Agent.
Your goal is to complete the user's task using the available tools.

AVAILABLE TOOLS:
${JSON.stringify(AGENT_TOOLS_METADATA, null, 2)}

STRATEGY:
1. EXPLORE: Briefly list files or read package.json. Do NOT over-read files; once you understand the tech stack, move to execution.
2. EXECUTE: Use terminal_execute for commands and file_edit for code changes.
3. OBSERVE: Analyze terminal output immediately.
4. VERIFY: After any change, run a command to verify it.
5. NO LOOPING: If you read a file once, you probably don't need to read it again unless it changed. Move forward!
6. FINISH: Use the "finish" action as soon as the task objective is met and verified.

RESPONSE FORMAT:
You must respond with a JSON object. 
If you want to use a tool:
{
  "thought": "your reasoning here",
  "action": {
    "type": "tool",
    "tool": { 
      "name": "tool_name", 
      "args": { "arg1": "val1" } 
    }
  }
}
If you are done:
{
  "thought": "your reasoning here",
  "action": { "type": "finish", "summary": "what was accomplished" }
}

Keep thoughts concise.`;

  let iteration = 0;
  let completed = false;
  let summary = "Task in progress";

  while (iteration < (input.maxIterations || MAX_ITERATIONS)) {
    iteration++;

    // Throttle to prevent rate limiting
    if (iteration > 1) await new Promise(r => setTimeout(r, 800));

    // Prepare context for the LLM
    const history = logs.map(l => 
      `--- PREVIOUS ACTION ---
Thought: ${l.thought}
Action: ${l.tool ? `${l.tool.name}(${JSON.stringify(l.tool.args)})` : l.status}
Result: ${l.output.slice(0, 500)}`
    ).join("\n\n");

    const prompt = `Current Task: ${currentTask}

--- ROADMAP ---
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

--- TERMINAL DIAGNOSTICS ---
Last Exit Code: ${logs.length > 0 ? logs[logs.length-1].status === 'error' ? '1 (Error)' : '0 (Success)' : 'N/A'}
Memory:
- Touched Files: ${memory.getTouchedFiles().join(", ") || "None"}
- Known Issues: ${memory.getErrors().slice(-3).join("; ") || "None"}

--- HISTORY ---
${history || "No history yet."}

What is your next move? (Remember: Run a command to verify any change you made)`;

    let decision: AgentDecision;
    try {
      const response = await callAgentModel({
        provider: input.provider,
        apiKey: input.apiKey,
        model: input.model,
        endpoint: input.endpoint,
        prompt,
        systemInstruction,
      });
      decision = parseDecision(response);
    } catch (err: any) {
      logs.push({
        iteration,
        thought: "Critical error in model communication.",
        status: "error",
        output: err.message,
      });
      break;
    }

    if (decision.action.type === "finish") {
      completed = true;
      summary = decision.action.summary;
      logs.push({
        iteration,
        thought: decision.thought,
        status: "finish",
        output: summary,
      });
      break;
    }

    // 2. Execution (Inspired by VS Code 'Task Runner')
    let toolCall = decision.action.tool;
    let toolOutput = "";
    let status: "ok" | "error" = "ok";

    // Robustness: Handle common tool-call formatting errors
    if (decision.action.type === "tool") {
      if (!toolCall) {
        status = "error";
        toolOutput = "Error: Action type was 'tool' but the 'tool' object was missing in your JSON.";
      } else if (typeof toolCall === "string") {
        // AI sent tool name as string instead of object
        toolCall = { name: toolCall as any, args: {} };
      }
    }

    if (status === "ok" && decision.action.type === "tool" && toolCall) {
      // Support Human-in-the-Loop: Pause BEFORE execution for user approval
      if (input.interactive) {
        return {
          success: true,
          completed: false,
          iterations: iteration,
          summary: `Proposed Action: ${toolCall.name}`,
          logs,
          touchedFiles: memory.getTouchedFiles(),
          initialSteps: steps,
          pendingTool: toolCall,
          thought: decision.thought,
        } as any;
      }
      try {
      const result = await executeToolCall(toolCall, {
        workspaceRoot: input.workspaceRoot,
        userId: input.userId || "local-user",
        folder: input.folder,
      });

      toolOutput = result.output;
      if (result.touchedFile) memory.addTouchedFile(result.touchedFile);

      // 3. Observation (Inspired by VS Code 'Problem Matchers')
      const observation = analyzeOutput(toolOutput);
      
      if (observation.status === "error") {
        status = "error";
        memory.addError(`[Iteration ${iteration}] ${observation.feedback}`);
        
        // 4. Autonomous Fixing (Inspired by VS Code 'Quick Fix')
        if (observation.suggestedFix) {
          toolOutput += `\n\nSYSTEM SUGGESTION: ${observation.suggestedFix}`;
        }
      }

      if (observation.status === "success" && iteration > 1) {
        // Potential early finish if success signal detected in output
        // We'll let the LLM decide if it's actually finished.
      }

    } catch (err: any) {
      status = "error";
      toolOutput = `Tool execution failed: ${err.message}`;
      memory.addError(`[Iteration ${iteration}] Crash: ${err.message}`);
    }
    }

    logs.push({
      iteration,
      thought: decision.thought,
      tool: toolCall,
      status,
      output: toolOutput,
    });

    if (input.interactive) {
      break;
    }
  }

  return {
    success: true,
    completed,
    iterations: iteration,
    summary,
    logs,
    touchedFiles: memory.getTouchedFiles(),
    initialSteps: steps,
  } as any;
}