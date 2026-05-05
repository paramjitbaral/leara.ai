const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\//i,
  /\brm\s+-rf\s+~\//i,
  /\bdel\s+\/f\s+\/s\s+\/q\b/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\btaskkill\b.*\/f/i,
  /:\s*\(\)\s*\{\s*:\|:&\s*\};\s*:/,
  /curl\s+.*\|\s*(sh|bash|zsh)/i,
  /Invoke-Expression\b/i,
];

export function clampIterations(maxIterations?: number): number {
  if (!maxIterations || Number.isNaN(maxIterations)) return 6;
  return Math.max(1, Math.min(10, maxIterations));
}

export function validateTerminalCommand(command: string): { ok: boolean; reason?: string } {
  const trimmed = (command || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "Command cannot be empty." };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        ok: false,
        reason: "Blocked potentially destructive command by safety policy.",
      };
    }
  }

  // Block natural language sentences (hallucinations)
  const nonShellWords = ["check", "analyze", "look", "determine", "verify", "inspect", "understand", "explore"];
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  if (nonShellWords.includes(firstWord) && trimmed.split(/\s+/).length > 2) {
    return {
      ok: false,
      reason: `Command "${trimmed}" looks like a natural language sentence, not a shell command. Use valid shell commands instead (e.g. ls, cat, npm).`
    };
  }

  return { ok: true };
}
