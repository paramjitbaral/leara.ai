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
