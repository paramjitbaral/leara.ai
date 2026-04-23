import { LearningSession, LearningStep, Explanation, Exercise } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useStore } from "../store";

async function callAI(prompt: string, systemInstruction: string, context: any = {}): Promise<string> {
  const { aiProvider, userApiKey, aiModel, aiEndpoint, providerKeys } = useStore.getState();
  
  const activeKey = providerKeys[aiProvider] || userApiKey;

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
      systemInstruction: `You are a minimalist coding mentor.
    - Adapt response length to query. If user says 'hi/hello', respond in ONE SENTENCE.
    - Be extremely concise. Use technical bullet points.
    - Prioritize speed and direct answers.
    - Do not over-explain basic concepts unless asked.`
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.response;
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
  
  const explanation = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim() || '{}');
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
  
  const exercises = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim() || '[]');
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
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (err: any) {
    return { correct: false, feedback: "Evaluation failed." };
  }
}

export async function generateInitialLearningStep(content: string, language: string): Promise<{ sessionInfo: { title: string, description: string }, firstStep: LearningStep }> {
  const text = await callAI(
    `Full Code:\n${content}`,
    `Create the FIRST step of a "build from scratch" coding lesson. 
    Return ONLY JSON:
    {
      "sessionInfo": { "title": "string", "description": "string" },
      "firstStep": { 
        "id": "step1", "title": "string", "goal": "string", "expectedOutput": "string", 
        "tasks": string[], "partialCode": "string", "solution": "string", "hint": "string", "validationLogic": "string" 
      }
    }`,
    { language, content }
  );
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}

export async function generateRemainingLearningSteps(content: string, language: string, title: string): Promise<{ steps: LearningStep[], finalExplanation: string, understandingCheck: string, practiceProblem: any }> {
  const text = await callAI(
    `Code:\n${content}`,
    `Generate steps 2-5 for the lesson "${title}".
    Return ONLY JSON:
    {
      "steps": Array<LearningStep>,
      "finalExplanation": "string",
      "understandingCheck": "string",
      "practiceProblem": { "question": "string", "starterCode": "string", "solution": "string" }
    }`,
    { language, content, title }
  );
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}
