import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Smartly merges AI-suggested code into existing file content.
 * Handles Search/Replace patterns, targeted tag replacements, and full-file swaps.
 */
export function smartMergeCode(currentContent: string, suggestedCode: string): string {
  const code = suggestedCode.trim();
  const content = currentContent;

  // 1. Detect Search/Replace or Original/Updated patterns
  // Pattern: [Original/Search/OLD] ... [Updated/Replace/NEW] ...
  const srMatch = code.match(/(?:Original|Search|OLD|BEFORE)[\s\S]*?-->?\s*([\s\S]+?)\s*<!--?\s*(?:Updated|Replace|NEW|AFTER)[\s\S]*?-->?\s*([\s\S]+)$/i) ||
                  code.match(/(?:Original|Search|OLD|BEFORE)[:\s-]*\n([\s\S]+?)\n(?:Updated|Replace|NEW|AFTER)[:\s-]*\n([\s\S]+)$/i);

  if (srMatch) {
    const search = srMatch[1].trim();
    const replace = srMatch[2].trim();
    if (content.includes(search)) {
      return content.replace(search, replace);
    }
  }

  // 2. Full File Heuristic
  // If it starts with common headers and is a significant portion of the file
  if (code.startsWith('<!DOCTYPE') || code.startsWith('import React') || code.startsWith('package ')) {
    if (code.length > content.length * 0.5) {
      return code;
    }
  }

  // 3. Targeted Line Replacement (Fuzzy)
  // If the suggested code is a single line/tag and a similar one exists
  const suggestedLines = code.split('\n').filter(l => l.trim().length > 0);
  if (suggestedLines.length === 1) {
    const line = suggestedLines[0].trim();
    
    // Match common HTML tags
    const tagMatch = line.match(/^<([a-z0-9-]+)/i);
    if (tagMatch) {
      const tagName = tagMatch[1];
      const tagRegex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
      const matches = content.match(tagRegex);
      if (matches && matches.length === 1) {
        return content.replace(tagRegex, line);
      }
    }
    
    // Match common JS imports/exports/assignments
    const jsMatch = line.match(/^(import|export|const|let|var|function)\s+([a-zA-Z0-9_{}\s*]+)/);
    if (jsMatch) {
      const keyword = jsMatch[1];
      const identifier = jsMatch[2].trim();
      const jsRegex = new RegExp(`^${keyword}\\s+${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?;?$`, 'm');
      if (content.match(jsRegex)) {
        return content.replace(jsRegex, line);
      }
    }
  }

  // 4. Avoid Duplication
  // If the exact code is already in the file, don't do anything
  if (content.includes(code)) {
    return content;
  }

  // 5. Default: Append
  return content.trimEnd() + '\n\n' + code;
}
