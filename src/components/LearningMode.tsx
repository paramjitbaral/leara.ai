import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BookOpen, BrainCircuit, CheckCircle2, XCircle, ChevronRight, Loader2, RefreshCw, Lock, Unlock, ShieldCheck, X, ArrowLeft, Send, Settings } from 'lucide-react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { FileData, LearningSession, LearningStep } from '../types';
import { generateInitialLearningStep, generateRemainingLearningSteps, validateAnswer } from '../services/ai';
import { cn } from '../lib/utils';
import { PinSystem } from './PinSystem';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useStore } from '../store';

interface LearningModeProps {
  activeFile: FileData | null;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function LearningMode({ activeFile, onClose, onOpenSettings }: LearningModeProps) {
  const { user } = useStore();
  const [session, setSession] = useState<LearningSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userCode, setUserCode] = useState('');
  const [validationResult, setValidationResult] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [showExitPin, setShowExitPin] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [understandingAnswer, setUnderstandingAnswer] = useState('');
  const [isUnderstandingSubmitted, setIsUnderstandingSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const editorRef = useRef<any>(null);

  const saveProgress = async () => {
    if (!user || !session || !activeFile) return;
    try {
      await addDoc(collection(db, 'userProgress'), {
        userId: user.uid,
        projectId: activeFile.projectId || 'default',
        projectName: activeFile.projectName || 'Default Project',
        sessionTitle: session.title,
        completedAt: serverTimestamp(),
        stepsCount: session.steps.length,
        language: activeFile.language || 'javascript'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'userProgress');
    }
  };

  useEffect(() => {
    const initSession = async () => {
      if (!activeFile) return;
      setError(null);
      try {
        setLoading(true);
        // Step 1: Load only the first step immediately
        const { sessionInfo, firstStep } = await generateInitialLearningStep(activeFile.content, activeFile.language || 'javascript');
        
        const initialSession: LearningSession = {
          id: firstStep.id,
          title: sessionInfo.title,
          description: sessionInfo.description,
          steps: [firstStep],
          finalExplanation: '',
          understandingCheck: '',
          practiceProblem: { question: '', starterCode: '', solution: '' }
        };
        
        setSession(initialSession);
        setUserCode(firstStep.partialCode);
        setLoading(false);

        // Step 2: Load remaining steps in the background
        setBackgroundLoading(true);
        try {
          const remaining = await generateRemainingLearningSteps(activeFile.content, activeFile.language || 'javascript', sessionInfo.title);
          
          setSession(prev => {
            if (!prev) return null;
            return {
              ...prev,
              steps: [prev.steps[0], ...remaining.steps],
              finalExplanation: remaining.finalExplanation,
              understandingCheck: remaining.understandingCheck,
              practiceProblem: remaining.practiceProblem
            };
          });
        } catch (err) {
          console.error('Failed to load remaining steps:', err);
        } finally {
          setBackgroundLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to init learning session:', err);
        const isQuotaError = err?.message?.includes('quota') || err?.message?.includes('429') || err?.status === 'RESOURCE_EXHAUSTED';
        setError(isQuotaError ? 'AI Quota Exceeded. Please try again in a minute or check your API key.' : 'Failed to start learning session. Please try again.');
        setLoading(false);
      }
    };
    initSession();
  }, [activeFile]);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Disable copy/paste
    editor.onKeyDown((e: any) => {
      // 31: C, 52: V, 33: X
      if ((e.ctrlKey || e.metaKey) && (e.keyCode === 31 || e.keyCode === 52 || e.keyCode === 33)) {
        e.preventDefault();
      }
    });
  };

  const currentStep = session?.steps[currentStepIndex];

  const handleSubmit = async () => {
    if (!currentStep || !session) return;
    setValidating(true);
    try {
      const result = await validateAnswer(
        `Task: ${currentStep.tasks.join(', ')}\nGoal: ${currentStep.goal}`,
        userCode,
        currentStep.solution
      );
      setValidationResult(result);
      if (result.correct) {
        // Unlock next step or finish
        if (currentStepIndex < session.steps.length - 1) {
          // Wait a bit then move to next step
          const nextIndex = currentStepIndex + 1;
          setTimeout(() => {
            setCurrentStepIndex(nextIndex);
            setUserCode(session.steps[nextIndex].partialCode);
            setValidationResult(null);
          }, 2000);
        } else {
          setIsCompleted(true);
          saveProgress();
        }
      }
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setValidating(false);
    }
  };

  const handleExit = () => {
    setShowExitPin(true);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[90] bg-[#1e1e1e] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
        <p className="text-zinc-400 animate-pulse">Building focused learning environment...</p>
      </div>
    );
  }

  if (error) {
    const isQuotaError = error.includes('Quota Exceeded');
    return (
      <div className="fixed inset-0 z-[90] bg-[#1e1e1e] flex flex-col items-center justify-center space-y-6 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
          <XCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">Oops! Something went wrong</h3>
          <p className="text-zinc-400 max-w-md">{error}</p>
          {isQuotaError && (
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              The shared AI quota is exhausted. You can add your own Gemini API key in settings to continue immediately, or wait 24 hours for the shared quota to reset.
            </p>
          )}
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[#333333] hover:bg-[#444444] text-white rounded-xl font-bold transition-all"
          >
            Go Back
          </button>
          {isQuotaError ? (
            <button 
              onClick={onOpenSettings}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Open Settings
            </button>
          ) : (
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!session || !currentStep) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-[#1e1e1e] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-[#333333] flex items-center justify-between px-6 bg-[#252526]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{session.title}</h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Step {currentStepIndex + 1} of {session.steps.length}</p>
              {backgroundLoading && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] text-zinc-600 uppercase font-bold">Loading more...</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (confirm('Reset your PIN? You will be asked to create a new one next time.')) {
                localStorage.removeItem('learning_pin');
                onClose();
              }
            }}
            className="px-3 py-1.5 hover:bg-white/5 text-zinc-500 hover:text-zinc-300 text-[10px] font-bold rounded-lg transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Reset PIN
          </button>
          <button 
            onClick={handleExit}
            className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-all flex items-center gap-2"
          >
            <Lock className="w-3 h-3" />
            Exit Learning Mode
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Instructions */}
        <div className="w-1/3 border-r border-[#333333] flex flex-col bg-[#252526] overflow-y-auto p-6 space-y-8 no-scrollbar">
          <section className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 1: The Goal</h4>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3">
              <p className="text-sm text-zinc-300 leading-relaxed">{currentStep.goal}</p>
              <div className="pt-2 border-t border-emerald-500/10">
                <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Expected Output</p>
                <code className="text-xs text-zinc-400">{currentStep.expectedOutput}</code>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 2: Tasks</h4>
            <ul className="space-y-3">
              {currentStep.tasks.map((task, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold flex items-center justify-center border border-emerald-500/20 shrink-0">
                    {i + 1}
                  </span>
                  {task}
                </li>
              ))}
            </ul>
          </section>

          {validationResult && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-xl border flex gap-3",
                validationResult.correct 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              )}
            >
              {validationResult.correct ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
              <div className="space-y-1">
                <p className="text-sm font-bold">{validationResult.correct ? 'Correct! ✅' : 'Incorrect ❌'}</p>
                <p className="text-xs leading-relaxed">{validationResult.feedback}</p>
              </div>
            </motion.div>
          )}

          {isCompleted && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
                <Sparkles className="w-8 h-8 text-emerald-400 mx-auto" />
                <h3 className="text-lg font-bold text-white">Course Completed!</h3>
                <p className="text-xs text-zinc-400">You've built the logic from scratch.</p>
              </div>

              <section className="space-y-4">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 8: Understanding Check</h4>
                <div className="space-y-3">
                  <p className="text-sm text-zinc-300">{session.understandingCheck}</p>
                  <textarea 
                    value={understandingAnswer}
                    onChange={(e) => setUnderstandingAnswer(e.target.value)}
                    placeholder="Explain how this code works..."
                    className="w-full h-32 bg-[#1e1e1e] border border-[#333333] rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                  />
                  <button 
                    onClick={() => setIsUnderstandingSubmitted(true)}
                    disabled={understandingAnswer.length < 10}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Submit Explanation
                  </button>
                </div>
              </section>

              {isUnderstandingSubmitted && (
                <section className="space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 9: Practice Problem</h4>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3">
                    <p className="text-sm text-zinc-300">{session.practiceProblem.question}</p>
                    <button className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 transition-all">
                      Try Similar Problem
                    </button>
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Panel: Editor */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          <div className="h-10 border-b border-[#333333] flex items-center px-4 bg-[#252526] justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Exercise Editor</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">No Copy-Paste Allowed</span>
            </div>
          </div>
          
          <div className="flex-1 relative">
            <MonacoEditor
              height="100%"
              language={activeFile?.language || 'javascript'}
              theme="vs-dark"
              value={userCode}
              onMount={handleEditorDidMount}
              onChange={(val) => setUserCode(val || '')}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 20 },
                lineNumbers: 'on',
                renderWhitespace: 'none',
                tabSize: 2,
                wordWrap: 'on',
                contextmenu: false, // Disable right click
                readOnly: isCompleted,
              }}
            />
            
            <div className="absolute bottom-8 right-8">
              <button 
                onClick={handleSubmit}
                disabled={validating || isCompleted}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-bold shadow-2xl shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95"
              >
                {validating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Submit Code
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showExitPin && (
          <PinSystem 
            mode="verify"
            onSuccess={() => {
              setShowExitPin(false);
              onClose();
            }}
            onCancel={() => setShowExitPin(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
