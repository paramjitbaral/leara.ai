import { AgentToolCall } from "./types";

interface AttemptRecord {
  signature: string;
  count: number;
}

export class AgentMemory {
  private readonly touchedFiles = new Set<string>();
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly errors: string[] = [];

  addTouchedFile(filePath?: string) {
    if (!filePath) return;
    this.touchedFiles.add(filePath.replace(/\\/g, "/"));
  }

  addError(error: string) {
    if (!error) return;
    this.errors.push(error.slice(0, 1200));
  }

  registerToolAttempt(tool: AgentToolCall): number {
    const signature = `${tool.name}:${JSON.stringify(tool.args || {})}`;
    const existing = this.attempts.get(signature);
    if (existing) {
      existing.count += 1;
      return existing.count;
    }
    this.attempts.set(signature, { signature, count: 1 });
    return 1;
  }

  summarizeForPrompt(): string {
    const attemptLines = Array.from(this.attempts.values())
      .slice(-8)
      .map((a) => `${a.signature} (x${a.count})`)
      .join("\n");

    const lastErrors = this.errors.slice(-5).join("\n");

    return [
      "Recent tool attempts:",
      attemptLines || "None",
      "Recent errors:",
      lastErrors || "None",
    ].join("\n");
  }

  getTouchedFiles(): string[] {
    return Array.from(this.touchedFiles.values());
  }

  getErrors(): string[] {
    return [...this.errors];
  }
}
