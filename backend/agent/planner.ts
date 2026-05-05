import { callAgentModel } from "./llm";

export async function planTask(args: {
  task: string;
  provider: any;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}): Promise<string[]> {
  const prompt = `Break this task into clear executable steps for a coding agent.
Return ONLY a valid JSON array of strings. No markdown, no explanation.

Task:
${args.task}`;

  try {
    const res = await callAgentModel({
      provider: args.provider,
      apiKey: args.apiKey,
      model: args.model,
      endpoint: args.endpoint,
      prompt,
      systemInstruction: "You are a task planner. Respond only with JSON arrays of strings.",
    });
    
    // Attempt to parse JSON
    const match = res.match(/\[[\s\S]*\]/);
    const jsonStr = match ? match[0] : res;
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Planning failed, falling back to single step:", err);
    return [args.task];
  }
}
