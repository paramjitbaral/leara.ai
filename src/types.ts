export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface FileData {
  id: string;
  name: string;
  content: string;
  language: string;
  projectId: string;
  projectName?: string;
  path: string;
}

export interface UserProgress {
  userId: string;
  projectId: string;
  completedDays: number[];
  lastActiveFileId?: string;
}

export interface Explanation {
  summary: string[]; // Step 1
  visualFlow: string; // Step 2
  mainBlock: { // Step 3
    name: string;
    bullets: {
      text: string;
      lineRange: { start: number; end: number };
    }[];
  };
  prediction: { // Step 4
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
  executionSteps: { // Step 5
    line: number;
    description: string;
    variables: Record<string, any>;
    conditionResult?: boolean;
  }[];
  experiment: { // Step 6
    task: string;
    expectedOutcome: string;
  };
  debugTask: { // Step 7
    buggyCode: string;
    description: string;
    solution: string;
  };
  practice: { // Step 8
    fillInCode: {
      template: string;
      missingPart: string;
      answer: string;
    };
    logicQuestion: {
      question: string;
      answer: string;
    };
  };
  dsa?: { // Step 10
    categories: string[];
    technique: string;
    timeComplexity: string;
    spaceComplexity: string;
  };
  realWorldConnection: string[]; // Step 11
  miniRecap: string[]; // Step 12
  whyThisApproach: string[]; 
}

export interface Exercise {
  id: string;
  type: 'completion' | 'question';
  question: string;
  codeTemplate?: string;
  correctAnswer: string;
  hint: string;
}

export interface LearningStep {
  id: string;
  title: string;
  goal: string;
  expectedOutput: string;
  tasks: string[];
  partialCode: string;
  solution: string;
  hint: string;
  validationLogic: string; // Description of how to validate
}

export interface LearningSession {
  id: string;
  title: string;
  description: string;
  steps: LearningStep[];
  finalExplanation: string;
  understandingCheck: string;
  practiceProblem: {
    question: string;
    starterCode: string;
    solution: string;
  };
}

export interface AICache {
  hash: string;
  explanation: Record<number, Explanation>; // Level 1, 2, 3
  exercises: Exercise[];
  questions: string[];
}

// ========== NEW: Teacher-First Learning System ==========

/** A single line annotation explaining what a specific line of code does */
export interface LineAnnotation {
  lineNumber: number;
  code: string;
  explanation: string;          // What this line does
  whyNeeded: string;            // Why this line exists / what problem it solves
  keywords: { word: string; meaning: string }[];  // Key terms in this line explained
}

/** A teaching phase — the AI explains a chunk of code like a teacher on a whiteboard */
export interface TeachingPhase {
  id: string;
  title: string;                     // e.g. "Part 1: Understanding HTML Structure"
  analogy: string;                   // Real-world analogy to introduce the concept
  conceptExplanation: string;        // 2-4 sentence explanation of the concept
  codeSnippet: string;               // The exact code chunk being taught
  lineAnnotations: LineAnnotation[]; // Line-by-line breakdown
  keyTakeaway: string;               // One-liner summary of what was just learned
}

/** A quiz question to test understanding of the teaching phase */
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;  // Why the correct answer is correct
}

/** A quiz phase — test understanding after a teaching block */
export interface QuizPhase {
  id: string;
  relatedTeachingId: string;   // Links back to which teaching phase this tests
  questions: QuizQuestion[];
}

/** A coding challenge — student must modify/rewrite code in a sandbox */
export interface CodingChallenge {
  id: string;
  title: string;
  instruction: string;        // What the student should do
  starterCode: string;        // Pre-filled code (sandbox only, never real file)
  expectedCode: string;       // The correct solution
  hints: string[];             // Progressive hints
  validationPrompt: string;   // Used by AI to check the student's code
}

/** A complete lesson — the full learning journey for one file */
export interface LearningLesson {
  id: string;
  title: string;
  description: string;
  language: string;
  originalCode: string;        // Snapshot of real code — never modified
  phases: LessonPhase[];       // Ordered sequence of teach → quiz → code
  completionMessage: string;
}

/** A union type representing each phase in a lesson */
export type LessonPhase = 
  | { type: 'teaching'; data: TeachingPhase }
  | { type: 'quiz'; data: QuizPhase }
  | { type: 'coding'; data: CodingChallenge };
