const BLOCKED_TERMS = [
  /\brm\s+-rf\s+\//i,
  /\brm\s+-rf\s+~\//i,
  /\bdel\s+\/f\s+\/s\s+\/q\b/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\bpoweroff\b/i,
  /\btaskkill\b.*\/f/i,
  /\bgit\s+push\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
];

const NEED_APPROVAL = [
  /\bgit\s+push\b/i,
  /\bgit\s+rebase\b/i,
  /\bgit\s+reset\b/i,
  /\bnpm\s+publish\b/i,
  /\brm\b/i,
  /\bdel\b/i,
];

export function evaluateCommandPolicy(command: string, approved: boolean = false): { allowed: boolean; requiresApproval: boolean; reason?: string } {
  const cmd = (command || "").trim();
  if (!cmd) return { allowed: false, requiresApproval: false, reason: "Empty command" };

  for (const pattern of BLOCKED_TERMS) {
    if (pattern.test(cmd)) {
      return { allowed: false, requiresApproval: false, reason: "Blocked by policy" };
    }
  }

  for (const pattern of NEED_APPROVAL) {
    if (pattern.test(cmd) && !approved) {
      return { allowed: false, requiresApproval: true, reason: "Command requires explicit approval" };
    }
  }

  return { allowed: true, requiresApproval: false };
}
