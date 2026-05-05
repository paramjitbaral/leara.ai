import { LearningSession, LearningStep, Explanation, Exercise, LearningLesson, TeachingPhase, QuizPhase, CodingChallenge, LessonPhase } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useStore } from "../store";

async function callAI(prompt: string, systemInstruction: string, context: any = {}): Promise<string> {
  const { aiProvider, userApiKey, aiModel, aiEndpoint, providerKeys } = useStore.getState();
  const activeKey = providerKeys[aiProvider] || userApiKey;

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout to allow backend fallbacks

    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          prompt, 
          context, 
          provider: aiProvider, 
          apiKey: activeKey,
          model: aiModel,
          endpoint: aiEndpoint,
          systemInstruction: systemInstruction || `You are a minimalist coding mentor.
        - Adapt response length to query. If user says 'hi/hello', respond in ONE SENTENCE.
        - Be extremely concise. Use technical bullet points.
        - Prioritize speed and direct answers.
        - Do not over-explain basic concepts unless asked.`
        })
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.error) {
        if (data.error.includes('quota') || data.error.includes('429')) {
          attempts++;
          await new Promise(r => setTimeout(r, 1000 * attempts)); // Backoff
          continue;
        }
        throw new Error(data.error);
      }
      return data.response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      attempts++;
      if (attempts >= MAX_ATTEMPTS) throw new Error(err.message || "AI call failed after retries");
      await new Promise(r => setTimeout(r, 500 * attempts));
    }
  }
  throw new Error("AI call failed after retries");
}

async function getCache(hash: string): Promise<any | null> {
  try {
    if (!db) return null;
    const q = query(collection(db, "aiCache"), where("hash", "==", hash));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }
  } catch (error) {
    console.error("Cache Read Error:", error);
  }
  return null;
}

async function setCache(hash: string, data: any) {
  try {
    if (!db) return;
    await addDoc(collection(db, "aiCache"), {
      hash,
      ...data,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, "aiCache");
  }
}

function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
  }
  return hash.toString();
}

function extractJSON(text: string): any {
  // Try to find content between first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  
  if (start !== -1) {
    const effectiveEnd = end !== -1 ? end + 1 : text.length;
    let jsonStr = text.substring(start, effectiveEnd);

    // Auto-Repair: If it ends abruptly, try to close it
    if (end === -1 || !jsonStr.endsWith('}')) {
      console.warn("Auto-repairing truncated JSON...");
      // Count open vs close braces
      const opens = (jsonStr.match(/\{/g) || []).length;
      const closes = (jsonStr.match(/\}/g) || []).length;
      if (opens > closes) {
        jsonStr += '}'.repeat(opens - closes);
      }
    }

    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Last resort: clean markdown
      const clean = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
      try { return JSON.parse(clean); } catch (e2) {
        throw new Error("Could not parse AI response as JSON");
      }
    }
  }
  
  throw new Error("No JSON object found in AI response");
}

export async function explainCode(code: string, language: string): Promise<Explanation> {
  const hash = generateHash(`explain-v2-${language}-${code}`);
  const cached = await getCache(hash);
  if (cached && cached.explanation) return cached.explanation;

  const text = await callAI(
    `Code Body:\n${code}`,
    `You are a Senior Engineering Mentor. Analyze this ${language} code and generate a comprehensive 12-step structured learning journey.
    Return ONLY a JSON object matching this precise interface:
    {
      "summary": string[],
      "visualFlow": "string",
      "mainBlock": { "name": "string", "bullets": Array<{ "text": "string", "lineRange": { "start": number, "end": number } }> },
      "prediction": { "question": "string", "options": string[], "correctAnswer": "string", "explanation": "string" },
      "executionSteps": Array<{ "line": number, "description": "string", "variables": Record<string, any> }>,
      "experiment": { "task": "string", "expectedOutcome": "string" },
      "debugTask": { "buggyCode": "string", "description": "string", "solution": "string" },
      "practice": { 
        "fillInCode": { "template": "string", "answer": "string" }, 
        "logicQuestion": { "question": "string", "answer": "string" } 
      },
      "dsa": { "categories": string[], "technique": "string", "timeComplexity": "string", "spaceComplexity": "string" },
      "realWorldConnection": string[],
      "miniRecap": string[]
    }`,
    { language, code }
  );
  
  const explanation = extractJSON(text);
  await setCache(hash, { explanation });
  return explanation;
}

export async function generateExercises(code: string, language: string, isStruggling: boolean): Promise<Exercise[]> {
  const hash = generateHash(`exercises-v2-${language}-${isStruggling}-${code}`);
  const cached = await getCache(hash);
  if (cached && cached.exercises) return cached.exercises;

  const text = await callAI(
    `Base Code:\n${code}`,
    `Generate 3 technical coding exercises. Return ONLY JSON array: 
    [ { "id": "string", "type": "completion" | "question", "question": "string", "codeTemplate": "string", "correctAnswer": "string", "hint": "string" } ]`,
    { language, code, isStruggling }
  );
  
  const raw = extractJSON(text);
  const exercises = Array.isArray(raw) ? raw : (raw.exercises || []);
  await setCache(hash, { exercises });
  return exercises;
}

export async function validateAnswer(question: string, userCode: string, solution: string): Promise<{ correct: boolean, feedback: string }> {
  try {
    const text = await callAI(
        `Question: ${question}\nUser: \`${userCode}\`\nSolution: \`${solution}\``,
        `Evaluate equivalence. Return ONLY JSON: { "correct": boolean, "feedback": "string" }`,
        { question, userCode, solution }
    );
    return extractJSON(text);
  } catch (err: any) {
    return { correct: false, feedback: "Evaluation failed." };
  }
}

export async function generateInitialLearningStep(content: string, language: string): Promise<{ sessionInfo: { title: string, description: string }, firstStep: LearningStep }> {
  const text = await callAI(
    `Full Code:\n${content}`,
    `You are "Professor Leara", a gentle and extremely patient coding teacher for absolute beginners.
    
    YOUR PEDAGOGY:
    1. THE ANALOGY: Start the lesson with a real-world analogy (e.g. "Think of a variable like a labeled box").
    2. THE "WHY": Explain why we need this specific part of the code in simple words. 
    3. THE DISCOVERY: Ask the student to do ONE tiny thing (e.g. "Change the word 'Hello' to your name").
    
    STEP 1 FOCUS:
    - Only look at the first 3-5 lines.
    - If it's HTML, teach what <!DOCTYPE> or <html> means using a "Greeting/Handshake" analogy.
    - If it's JS, teach what a comment or 'const' means.
    
    Return ONLY JSON:
    {
      "sessionInfo": { "title": "string", "description": "string" },
      "firstStep": { 
        "id": "step1", "title": "string", "goal": "string (Start with Analogy, then Explain, then the Goal)", "expectedOutput": "string", 
        "tasks": ["ONE tiny action only"], "partialCode": "string (The actual file content but with ONE small placeholder)", "solution": "string", "hint": "string", "validationLogic": "string" 
      }
    }`,
    { language, content }
  );
  return extractJSON(text);
}

export async function generateRemainingLearningSteps(content: string, language: string, title: string): Promise<{ steps: LearningStep[], finalExplanation: string, understandingCheck: string, practiceProblem: any }> {
  const text = await callAI(
    `Code:\n${content}`,
    `You are Professor Leara. Continue the lesson "${title}".
    
    RULES FOR STEPS 2-10:
    1. ONE CONCEPT PER STEP: Do not mix imports with logic.
    2. TEACH BEFORE TASK: The 'goal' field MUST contain a 2-3 sentence 'teacher's explanation' of the NEW part being introduced.
    3. SCAFFOLDING: Keep the previous code visible. Only the NEW target part should be a // TODO: or <!-- TODO: -->.
    4. NO OVERWHELM: If a task is too big, break it into two steps.
    5. HTML SAFETY: If writing in HTML, ensure students wrap JS in <script> tags or suggest they only edit existing tags.
    
    Return ONLY JSON:
    {
      "steps": Array<LearningStep>,
      "finalExplanation": "string",
      "understandingCheck": "string",
      "practiceProblem": { "question": "string", "starterCode": "string", "solution": "string" }
    }`,
    { language, content, title }
  );
  return extractJSON(text);
}


// ==========================================
// NEW: Progressive-Load Learning System
// ==========================================

/**
 * ULTRA-FAST: Generates ONLY the teaching explanation for the first few lines.
 * No quiz, no coding challenge — just the bare minimum to show content ASAP.
 * The user sees this within 3-5 seconds instead of waiting 15+ for everything.
 */
export async function generateQuickTeaching(content: string, language: string): Promise<{
  lessonInfo: { title: string; description: string };
  teaching: TeachingPhase;
}> {
  // Only send the first 30 lines to minimize token count & response time
  const truncatedContent = content.split('\n').slice(0, 30).join('\n');

  const text = await callAI(
    `Code:\n\`\`\`${language}\n${truncatedContent}\n\`\`\``,
    `You are Professor Leara, an expert coding tutor. 
Teach the first major logical chunk of this code (first 5-15 lines).
DO NOT just read line-by-line. Focus on DEEP conceptual understanding. Explain the "WHY" behind the code.
Highlight only the 2-4 most important lines that drive the logic, and explain them in extreme detail.
Use a real-world analogy. Be highly educational and comprehensive.
PRIORITIZE SPEED: Keep your response structure efficient to minimize generation time.

Return ONLY JSON:
{
  "lessonInfo": { "title": "string", "description": "string" },
  "teaching": {
    "id": "teach-1",
    "title": "string",
    "analogy": "string (Use Markdown: Think of it like...)",
    "conceptExplanation": "string (Use Markdown ordered/unordered lists to explain steps in order)",
    "codeSnippet": "string (first 5-15 lines)",
    "lineAnnotations": [
      { "lineNumber": 1, "code": "string", "explanation": "string", "whyNeeded": "string", "keywords": [] }
    ],
    "keyTakeaway": "string"
  }
}`,
    { language }
  );
  const raw = extractJSON(text);

  // Defensive normalization: AI may use different key names
  const lessonInfo = raw.lessonInfo || raw.lesson_info || { title: 'Learning Session', description: 'Let\'s learn this code!' };
  const teaching = raw.teaching || raw.firstPhase || raw.phase || raw.data || {};

  // Ensure teaching has required fields
  if (!teaching.id) teaching.id = 'teach-1';
  if (!teaching.title) teaching.title = lessonInfo.title || 'Part 1';
  if (!teaching.analogy) teaching.analogy = '';
  if (!teaching.conceptExplanation) teaching.conceptExplanation = '';
  if (!teaching.keyTakeaway) teaching.keyTakeaway = '';

  // CRITICAL: If codeSnippet or lineAnnotations are empty, generate from actual source
  const codeLines = truncatedContent.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
  
  if (!teaching.codeSnippet || typeof teaching.codeSnippet !== 'string' || teaching.codeSnippet.trim().length < 5) {
    teaching.codeSnippet = codeLines.join('\n');
  }

  if (!teaching.lineAnnotations || teaching.lineAnnotations.length === 0) {
    // Build basic annotations from the actual code so it's never blank
    teaching.lineAnnotations = codeLines.map((line, i) => ({
      lineNumber: i + 1,
      code: line,
      explanation: `This line contains: ${line.trim().substring(0, 60)}`,
      whyNeeded: 'This is part of the code structure.',
      keywords: []
    }));
  }

  // Fill in missing analogy/explanation with context-aware defaults
  if (!teaching.analogy) {
    teaching.analogy = `Think of this ${language} code like a recipe — each line is an instruction that tells the computer exactly what to do, in order.`;
  }
  if (!teaching.conceptExplanation) {
    teaching.conceptExplanation = `This section of ${language} code sets up the foundation. Let's walk through each line to understand what it does and why it's there.`;
  }
  if (!teaching.keyTakeaway) {
    teaching.keyTakeaway = `Every line in code has a purpose — understanding each one is the first step to writing your own!`;
  }

  return { lessonInfo, teaching };
}

/**
 * Generates a quiz for code that was just taught. Called in background
 * while the user is reading the teaching content.
 */
export async function generateQuizForTeaching(
  codeSnippet: string,
  language: string,
  teachingTitle: string
): Promise<QuizPhase> {
  const text = await callAI(
    `Code just taught:\n\`\`\`${language}\n${codeSnippet}\n\`\`\`\nLesson: "${teachingTitle}"`,
    `Generate 2-3 multiple choice quiz questions to test a beginner's understanding of this code.
Be encouraging. Each question should have 4 options.

Return ONLY JSON:
{
  "id": "quiz-1",
  "relatedTeachingId": "teach-1",
  "questions": [
    { "id": "q1", "question": "string", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "string" }
  ]
}`,
    { language, codeSnippet }
  );
  const raw = extractJSON(text);

  // Defensive normalization
  const quiz = raw.firstQuiz || raw.quiz || raw;
  if (!quiz.id) quiz.id = 'quiz-1';
  if (!quiz.relatedTeachingId) quiz.relatedTeachingId = 'teach-1';
  if (!quiz.questions) quiz.questions = [];

  return quiz;
}

// Keep the old function as a fallback alias
export async function generateFirstTeachingPhase(content: string, language: string): Promise<{
  lessonInfo: { title: string; description: string };
  firstPhase: TeachingPhase;
  firstQuiz: QuizPhase;
}> {
  const { lessonInfo, teaching } = await generateQuickTeaching(content, language);
  const quiz = await generateQuizForTeaching(teaching.codeSnippet, language, teaching.title);
  return { lessonInfo, firstPhase: teaching, firstQuiz: quiz };
}

/**
 * Generates the NEXT teaching phase, quiz, and coding challenge
 * for the very next logical chunk of code.
 */
export async function generateNextChunk(
  content: string, 
  language: string, 
  lessonTitle: string, 
  alreadyTaughtCode: string
): Promise<{
  phases: LessonPhase[];
  completionMessage: string;
}> {
  const text = await callAI(
    `Full Source Code:\n\`\`\`${language}\n${content}\n\`\`\`\n\nCRITICAL: The student has ALREADY MASTERED the following snippet:\n\`\`\`\n${alreadyTaughtCode}\n\`\`\``,
    `You are Professor Leara. Continue teaching the lesson "${lessonTitle}".
The student already knows the snippet provided above. You MUST teach the NEXT logical chunk of the code.

RULES:
1. DO NOT re-teach the lines the student already knows. Start teaching from the lines immediately AFTER the mastered snippet.
2. Teach ONLY ONE new logical chunk (5-15 lines). DO NOT try to teach the entire rest of the file.
3. Generate exactly 1 TeachingPhase, 1 QuizPhase, and 1 CodingChallenge for this new chunk.
4. Highlight the 2-4 most important new lines in the TeachingPhase and explain their deep logic.
5. Provide fully detailed, deep explanations.

Return ONLY JSON:
{
  "phases": [
    { 
      "type": "teaching", 
      "data": {
        "id": "teach-next",
        "title": "string",
        "analogy": "string (Use Markdown analogy)",
        "conceptExplanation": "string (Use Markdown LISTS to arrange steps in order)",
        "codeSnippet": "string",
        "lineAnnotations": [{ "lineNumber": number, "code": "string", "explanation": "string", "whyNeeded": "string", "keywords": [] }],
        "keyTakeaway": "string"
      }
    },
    {
      "type": "quiz",
      "data": {
        "id": "quiz-next",
        "relatedTeachingId": "teach-next",
        "questions": [{ "id": "string", "question": "string", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "string" }]
      }
    },
    {
      "type": "coding",
      "data": {
        "id": "code-next",
        "title": "string",
        "instruction": "string",
        "starterCode": "string",
        "expectedCode": "string",
        "hints": ["string"],
        "validationPrompt": "string"
      }
    }
  ],
  "completionMessage": "Great job mastering this part! Ready for more?"
}`,
    { language, content, lessonTitle }
  );
  
  const raw = extractJSON(text);
  
  // Defensive normalization: AI might return { phases: [...] } or just an array [...] or { data: { phases: [...] } }
  let phases = [];
  if (Array.isArray(raw)) {
    phases = raw;
  } else if (raw && Array.isArray(raw.phases)) {
    phases = raw.phases;
  } else if (raw && raw.data && Array.isArray(raw.data.phases)) {
    phases = raw.data.phases;
  } else {
    // Attempt to salvage any array from the object
    const possibleArray = Object.values(raw || {}).find(v => Array.isArray(v));
    if (possibleArray) phases = possibleArray;
  }

  // Filter out any garbage phases
  phases = phases.filter(p => p && p.type && p.data);

  return {
    phases,
    completionMessage: raw?.completionMessage || "Congratulations! You've mastered this code!"
  };
}

/**
 * Dynamically generates a brand NEW teaching phase to explain a concept differently 
 * when a student fails a quiz and needs reteaching.
 */
export async function generateDynamicReteach(
  codeSnippet: string,
  language: string,
  previousAnalogy: string
): Promise<{ teaching: TeachingPhase; quiz: QuizPhase }> {
  const text = await callAI(
    `Code struggling with:\n\`\`\`${language}\n${codeSnippet}\n\`\`\`\nPrevious analogy used (did not work): "${previousAnalogy}"`,
    `You are Professor Leara. The student failed the quiz on this code block. 
You must re-teach it COMPLETELY DIFFERENTLY.
1. Use a completely new, more relatable, and simpler analogy.
2. Break it down even smaller.
3. Be encouraging.

Return ONLY JSON:
{
  "teaching": {
    "id": "reteach",
    "title": "Let's look at this another way...",
    "analogy": "string (new simple analogy)",
    "conceptExplanation": "string (simpler explanation)",
    "codeSnippet": "${codeSnippet.replace(/\n/g, '\\n').replace(/"/g, '\\"')}",
    "lineAnnotations": [{ "lineNumber": number, "code": "string", "explanation": "string", "whyNeeded": "string", "keywords": [] }],
    "keyTakeaway": "string"
  },
  "quiz": {
    "id": "requiz",
    "relatedTeachingId": "reteach",
    "questions": [{ "id": "rq1", "question": "string (easier question)", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "string" }]
  }
}`,
    { language, codeSnippet }
  );
  
  const raw = extractJSON(text);
  return {
    teaching: raw.teaching || raw.firstPhase || raw.phase || raw.data || raw,
    quiz: raw.quiz || raw.firstQuiz || { questions: [] }
  };
}

/**
 * Generates endless additional practice for a student who wants to keep learning.
 */
export async function generateMoreChallenges(
  fullCode: string,
  language: string
): Promise<LessonPhase[]> {
  const text = await callAI(
    `Full Source Code:\n\`\`\`${language}\n${fullCode}\n\`\`\``,
    `The student has finished the main lesson but wants MORE practice to become perfect.
Generate 2-3 NEW, completely different, and slightly harder Coding Challenges or Advanced Quizzes based on this code.

Return ONLY JSON:
{
  "phases": [
    {
      "type": "coding",
      "data": {
        "id": "adv-code-1",
        "title": "Advanced Challenge: ...",
        "instruction": "string",
        "starterCode": "string",
        "expectedCode": "string",
        "hints": ["string"],
        "validationPrompt": "string"
      }
    }
  ]
}`,
    { language }
  );
  
  const raw = extractJSON(text);
  return raw.phases || raw.data?.phases || Object.values(raw).find(v => Array.isArray(v)) || [];
}

/**
 * Validates a student's coding challenge submission against the expected solution.
 * Uses AI to evaluate semantic correctness, not just string matching.
 */
export async function validateCodingChallenge(
  instruction: string, 
  studentCode: string, 
  expectedCode: string,
  language: string
): Promise<{ correct: boolean; feedback: string; hint?: string }> {
  try {
    const text = await callAI(
      `Challenge: ${instruction}\nStudent Code:\n\`\`\`${language}\n${studentCode}\n\`\`\`\nExpected Solution:\n\`\`\`${language}\n${expectedCode}\n\`\`\``,
      `You are a kind, encouraging coding teacher evaluating a beginner's work.

RULES:
1. The student's code does NOT need to be identical — just functionally equivalent
2. Minor style differences (extra spaces, different variable names) are FINE
3. Be encouraging even if wrong — explain what they did right and what to fix
4. If wrong, give ONE specific, actionable hint (not the answer)

Return ONLY JSON:
{
  "correct": boolean,
  "feedback": "string (encouraging feedback — what they did right + what to improve)",
  "hint": "string (only if incorrect — one specific hint to guide them)"
}`,
      { instruction, studentCode, expectedCode, language }
    );
    return extractJSON(text);
  } catch (err) {
    return { correct: false, feedback: "I couldn't check your code right now. Try again!" };
  }
}
