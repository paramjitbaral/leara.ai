import { LearningSession, LearningStep, Explanation, Exercise } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useStore } from "../store";

async function callAI(prompt: string, systemInstruction: string, context: any = {}): Promise<string> {
  const { aiProvider, userApiKey, aiModel, aiEndpoint, providerKeys } = useStore.getState();
  const activeKey = providerKeys[aiProvider] || userApiKey;

  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  while (attempts < MAX_ATTEMPTS) {
    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      attempts++;
      if (attempts >= MAX_ATTEMPTS) throw err;
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
