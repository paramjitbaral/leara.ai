import { LearningSession, LearningStep, Explanation, Exercise } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useStore } from "../store";

async function callAI(prompt: string, systemInstruction: string, context: any = {}): Promise<string> {
  const { aiProvider, userApiKey, aiModel, aiEndpoint } = useStore.getState();
  
  const response = await fetch('/api/ai/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      prompt, 
      context, 
      provider: aiProvider, 
      apiKey: userApiKey,
      model: aiModel,
      endpoint: aiEndpoint,
      systemInstruction
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
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

export async function explainCode(code: string, language: string): Promise<Explanation> {
  const hash = generateHash(`explain-${language}-${code}`);
  const cached = await getCache(hash);
  if (cached && cached.explanation) return cached.explanation;

  const text = await callAI(
    `Code:\n${code}`,
    `Explain this ${language} code for a learner. Return ONLY a JSON object matching this interface: { title: string, explanation: string, keyConcepts: string[], complexity: string }`,
    { language, code }
  );
  
  const explanation = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim() || '{}');
  await setCache(hash, { explanation });
  return explanation;
}

export async function generateExercises(code: string, language: string, isStruggling: boolean): Promise<Exercise[]> {
  const hash = generateHash(`exercises-${language}-${isStruggling}-${code}`);
  const cached = await getCache(hash);
  if (cached && cached.exercises) return cached.exercises;

  const text = await callAI(
    `Code:\n${code}`,
    `Generate 3 coding exercises for this ${language} code. Difficulty: ${isStruggling ? 'Easy' : 'Normal'}. Return ONLY a JSON array of Exercise objects: { id: string, title: string, description: string, starterCode: string, solution: string }`,
    { language, code, isStruggling }
  );
  
  const exercises = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim() || '[]');
  await setCache(hash, { exercises });
  return exercises;
}

export async function generateInitialLearningStep(content: string, language: string): Promise<{ sessionInfo: any, firstStep: LearningStep }> {
  try {
    const text = await callAI(
      `Code:\n\`\`\`${language}\n${content}\n\`\`\``,
      `Analyze this code and create a structured learning session. Return ONLY a JSON object with: 
      - sessionInfo: { title: string, description: string }
      - firstStep: { id: string, title: string, goal: string, expectedOutput: string, tasks: string[], partialCode: string, solution: string, hint: string, validationLogic: string }`,
      { language, content }
    );

    if (!text) throw new Error("Empty response from AI");
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("AI Generation Error (Initial):", error);
    throw error;
  }
}

export async function generateRemainingLearningSteps(content: string, language: string, title: string): Promise<{ steps: LearningStep[], finalExplanation: string, understandingCheck: string, practiceProblem: any }> {
  try {
    const text = await callAI(
      `Full Code:\n\`\`\`${language}\n${content}\n\`\`\``,
      `Continue the learning session for "${title}". Generate remaining steps (2-5 more), finalExplanation, understandingCheck question, and a practiceProblem: { question, starterCode, solution }. Return ONLY JSON.`,
      { language, content, title }
    );

    if (!text) throw new Error("Empty response from AI");
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("AI Generation Error (Remaining):", error);
    throw error;
  }
}

export async function validateAnswer(task: string, userCode: string, solution: string): Promise<{ correct: boolean, feedback: string }> {
  try {
    const text = await callAI(
      `Task: ${task}\nUser Code: \`${userCode}\`\nReference Solution: \`${solution}\``,
      `Validate the user's code. Return ONLY JSON: { correct: boolean, feedback: string }`,
      { task, userCode, solution }
    );

    if (!text) throw new Error("Empty response from AI");
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("AI Validation Error:", error);
    return { correct: false, feedback: "Failed to validate code. Please try again." };
  }
}
