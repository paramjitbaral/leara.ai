export interface Observation {
  status: "success" | "error" | "continue";
  feedback: string;
  suggestedFix?: string;
}

export function analyzeOutput(output: string): Observation {
  const text = (output || "").toLowerCase();

  // 1. Success signals (Inspired by VS Code task 'isBackground' / 'beginsPattern')
  if (
    text.includes("localhost") || 
    text.includes("running at") || 
    text.includes("compiled successfully") ||
    text.includes("listening on port") ||
    text.includes("done in")
  ) {
    return {
      status: "success",
      feedback: "The process reached a successful state or is running in the background."
    };
  }

  // 2. Error matching (Inspired by VS Code Problem Matchers)
  const errorPatterns = [
    { 
      pattern: /cannot find module '([^']+)'/i, 
      fix: "npm install", 
      reason: "Missing dependency detected." 
    },
    { 
      pattern: /not found/i, 
      fix: "npm install", 
      reason: "Executable or package not found." 
    },
    { 
      pattern: /syntaxerror/i, 
      reason: "There is a syntax error in the code." 
    },
    { 
      pattern: /port (\d+) is already in use/i, 
      reason: "Network port conflict." 
    },
    {
      pattern: /missing script: "([^"]+)"/i,
      fix: "npm run",
      reason: "The requested npm script does not exist in package.json."
    }
  ];

  for (const entry of errorPatterns) {
    if (entry.pattern.test(text)) {
      return {
        status: "error",
        feedback: `Error detected: ${entry.reason}`,
        suggestedFix: entry.fix
      };
    }
  }

  // 3. General Error Fallback
  if (
    text.includes("error:") || 
    text.includes("failed to") || 
    text.includes("npm err!") ||
    text.includes("sh: 1:") ||
    text.includes("exitcode: 1")
  ) {
    return {
      status: "error",
      feedback: "Command failed with errors. Review the output for details."
    };
  }

  return {
    status: "continue",
    feedback: "The command executed, but no final success signal was detected yet."
  };
}
