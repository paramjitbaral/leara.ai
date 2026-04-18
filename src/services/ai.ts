import { GoogleGenAI, Type } from "@google/genai";
import { LearningSession, LearningStep, Explanation, Exercise } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please provide an API key in the settings to use AI features.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function getCache(hash: string): Promise<any | null> {
  try {
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

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Explain this ${language} code for a learner. Return JSON matching the Explanation interface.
    Code:
    ${code}`,
    config: {
      responseMimeType: "application/json",
    }
  });
  
  const explanation = JSON.parse(response.text || '{}');
  await setCache(hash, { explanation });
  return explanation;
}

export async function generateExercises(code: string, language: string, isStruggling: boolean): Promise<Exercise[]> {
  const hash = generateHash(`exercises-${language}-${isStruggling}-${code}`);
  const cached = await getCache(hash);
  if (cached && cached.exercises) return cached.exercises;

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 3 coding exercises for this ${language} code. Difficulty: ${isStruggling ? 'Easy' : 'Normal'}. Return JSON as Exercise[].
    Code:
    ${code}`,
    config: {
      responseMimeType: "application/json",
    }
  });
  
  const exercises = JSON.parse(response.text || '[]');
  await setCache(hash, { exercises });
  return exercises;
}

export async function generateInitialLearningStep(content: string, language: string): Promise<{ sessionInfo: any, firstStep: LearningStep }> {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this code and create a structured learning session.
      Code:
      \`\`\`${language}
      ${content}
      \`\`\`
      
      Return a JSON object with:
      - sessionInfo: { title: string, description: string }
      - firstStep: { id: string, title: string, goal: string, expectedOutput: string, tasks: string[], partialCode: string, solution: string, hint: string, validationLogic: string }
      
      The first step should be the most basic building block of the code.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sessionInfo: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["title", "description"]
            },
            firstStep: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                goal: { type: Type.STRING },
                expectedOutput: { type: Type.STRING },
                tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                partialCode: { type: Type.STRING },
                solution: { type: Type.STRING },
                hint: { type: Type.STRING },
                validationLogic: { type: Type.STRING }
              },
              required: ["id", "title", "goal", "expectedOutput", "tasks", "partialCode", "solution", "hint", "validationLogic"]
            }
          },
          required: ["sessionInfo", "firstStep"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    // Clean JSON if needed
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("AI Generation Error (Initial):", error);
    if (error?.message?.includes('quota') || error?.message?.includes('429')) {
      throw new Error("AI Quota Exceeded. Please try again later or check your API key.");
    }
    throw error;
  }
}

export async function generateRemainingLearningSteps(content: string, language: string, title: string): Promise<{ steps: LearningStep[], finalExplanation: string, understandingCheck: string, practiceProblem: any }> {
  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Continue the learning session for "${title}".
      Full Code:
      \`\`\`${language}
      ${content}
      \`\`\`
      
      Generate the remaining steps (2 to 5 more steps) to build up to the full code.
      Also provide a final explanation, an understanding check question, and a practice problem.
      
      Return a JSON object with:
      - steps: array of LearningStep objects (excluding the first one)
      - finalExplanation: string
      - understandingCheck: string
      - practiceProblem: { question: string, starterCode: string, solution: string }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  goal: { type: Type.STRING },
                  expectedOutput: { type: Type.STRING },
                  tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                  partialCode: { type: Type.STRING },
                  solution: { type: Type.STRING },
                  hint: { type: Type.STRING },
                  validationLogic: { type: Type.STRING }
                },
                required: ["id", "title", "goal", "expectedOutput", "tasks", "partialCode", "solution", "hint", "validationLogic"]
              }
            },
            finalExplanation: { type: Type.STRING },
            understandingCheck: { type: Type.STRING },
            practiceProblem: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                starterCode: { type: Type.STRING },
                solution: { type: Type.STRING }
              },
              required: ["question", "starterCode", "solution"]
            }
          },
          required: ["steps", "finalExplanation", "understandingCheck", "practiceProblem"]
        }
      }
    });

    const text = response.text;
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
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Validate the user's code against the task and solution.
      Task: ${task}
      User Code: \`${userCode}\`
      Reference Solution: \`${solution}\`
      
      Return a JSON object with:
      - correct: boolean
      - feedback: string (encouraging and helpful)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correct: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ["correct", "feedback"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("AI Validation Error:", error);
    return { correct: false, feedback: "Failed to validate code. Please try again." };
  }
}
