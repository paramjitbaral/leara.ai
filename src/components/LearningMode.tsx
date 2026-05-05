import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BrainCircuit, XCircle, Loader2, RefreshCw, Lock, Settings, BookOpen, HelpCircle, Code } from 'lucide-react';
import { FileData, LessonPhase, TeachingPhase, QuizPhase, CodingChallenge } from '../types';
import { generateQuickTeaching, generateQuizForTeaching, generateNextChunk, generateDynamicReteach, generateMoreChallenges } from '../services/ai';
import { cn } from '../lib/utils';
import { PinSystem } from './PinSystem';
import { TeachingView, QuizView, CodingView } from './LessonPhases';
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

  // Lesson state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phases, setPhases] = useState<LessonPhase[]>([]);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [completionMsg, setCompletionMsg] = useState('');

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [bgLoading, setBgLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [showExitPin, setShowExitPin] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Save progress
  const saveProgress = async () => {
    if (!user || !activeFile) return;
    try {
      if (db) {
        await addDoc(collection(db, 'userProgress'), {
          userId: user.uid,
          projectId: activeFile.projectId || 'default',
          projectName: activeFile.projectName || 'Default Project',
          sessionTitle: title,
          completedAt: serverTimestamp(),
          phasesCount: phases.length,
          language: activeFile.language || 'javascript'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'userProgress');
    }
  };

  // INIT: Progressive 3-Stage Pipeline
  // Stage 1: Teaching ONLY (fastest possible) → user sees content in ~3-5s
  // Stage 2: Quiz (background while user reads) → appended silently
  // Stage 3: Remaining phases (background while user does quiz) → appended silently
  useEffect(() => {
    if (!activeFile) return;
    setError(null);

    const { userApiKey, aiProvider, providerKeys, setIsApiKeyModalOpen } = useStore.getState();
    const activeKey = providerKeys[aiProvider] || userApiKey;
    if (!activeKey && aiProvider !== 'ollama') {
      setError('AI Access Key Required. Please connect your API key in settings to start learning.');
      setIsApiKeyModalOpen(true);
      setInitialLoading(false);
      return;
    }

    const lang = activeFile.language || 'javascript';

    (async () => {
      try {
        // ── STEP 0: Optimistic UI (Instant Load) ──
        // We show the code immediately so the user doesn't feel stuck on a loader.
        const skeletonTeaching: TeachingPhase = {
          id: 'teach-1',
          title: 'Analyzing Code...',
          analogy: '',
          conceptExplanation: '',
          codeSnippet: activeFile.content.split('\n').slice(0, 15).join('\n'),
          lineAnnotations: [],
          keyTakeaway: ''
        };

        setTitle('Preparing Lesson...');
        setDescription('Please wait while Professor Leara prepares your personal lesson plan.');
        setPhases([{ type: 'teaching', data: skeletonTeaching }]);
        setInitialLoading(false); // ← USER SEES UI IMMEDIATELY

        // ── STAGE 1: Real Teaching Data ──
        const { lessonInfo, teaching } = await generateQuickTeaching(activeFile.content, lang);

        setTitle(lessonInfo.title);
        setDescription(lessonInfo.description);
        setPhases([{ type: 'teaching', data: teaching }]);

        // ── STAGE 2: Generate quiz in background while user reads ──
        setBgLoading(true);
        try {
          const quiz = await generateQuizForTeaching(teaching.codeSnippet, lang, teaching.title);
          setPhases(prev => [...prev, { type: 'quiz', data: quiz }]);
        } catch (err) {
          console.warn('Quiz generation failed (non-critical):', err);
        } finally {
          setBgLoading(false);
        }

      } catch (err: any) {
        console.error('Init failed:', err);
        const isQuota = err?.message?.includes('quota') || err?.message?.includes('429');
        setError(isQuota ? 'AI Quota Exceeded. Try again in a minute or add your API key.' : `Failed to start: ${err.message}`);
        setInitialLoading(false);
      }
    })();
  }, [activeFile]);

  // Advance to next phase
  const goNext = () => {
    if (currentPhaseIdx < phases.length - 1) {
      setCurrentPhaseIdx(i => i + 1);
    } else if (!bgLoading) {
      setIsCompleted(true);
      saveProgress();
    }
  };

  // Generate a brand new teaching phase dynamically to explain it differently
  const goReteach = async () => {
    // Find the previous teaching phase to know what analogy failed
    let prevAnalogy = "None";
    let codeSnippet = "";
    for (let i = currentPhaseIdx - 1; i >= 0; i--) {
      if (phases[i].type === 'teaching') {
        prevAnalogy = (phases[i].data as TeachingPhase).analogy || "None";
        codeSnippet = (phases[i].data as TeachingPhase).codeSnippet || "";
        break;
      }
    }

    if (!codeSnippet && activeFile) codeSnippet = activeFile.content.slice(0, 300); // fallback

    setBgLoading(true);
    try {
      const { teaching, quiz } = await generateDynamicReteach(codeSnippet, activeFile?.language || 'javascript', prevAnalogy);
      
      // Insert the new teaching and quiz phases right after the current phase, and jump to the teaching
      const newPhases = [...phases];
      newPhases.splice(currentPhaseIdx + 1, 0, { type: 'teaching', data: teaching }, { type: 'quiz', data: quiz });
      setPhases(newPhases);
      setCurrentPhaseIdx(currentPhaseIdx + 1);
    } catch (err) {
      console.error('Reteach failed', err);
      // Fallback: just rewind
      for (let i = currentPhaseIdx - 1; i >= 0; i--) {
        if (phases[i].type === 'teaching') {
          setCurrentPhaseIdx(i);
          return;
        }
      }
    } finally {
      setBgLoading(false);
    }
  };

  const handleNextChunk = async () => {
    if (!activeFile) return;
    setInitialLoading(true);

    // Concatenate all previously taught code
    const alreadyTaught = phases
      .filter(p => p.type === 'teaching')
      .map(p => (p.data as TeachingPhase).codeSnippet || '')
      .join('\n');

    try {
      const next = await generateNextChunk(activeFile.content, activeFile.language || 'javascript', title, alreadyTaught);
      if (next.phases.length > 0) {
        setPhases(prev => [...prev, ...next.phases]);
        setIsCompleted(false);
        setCurrentPhaseIdx(phases.length); // Jump to the new chunk
        if (next.completionMessage) setCompletionMsg(next.completionMessage);
      } else {
        // No more code left to teach
        handleMorePractice();
      }
    } catch (err) {
      console.error('Failed to load next chunk', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleMorePractice = async () => {
    if (!activeFile) return;
    setInitialLoading(true);
    try {
      const morePhases = await generateMoreChallenges(activeFile.content, activeFile.language || 'javascript');
      if (morePhases.length > 0) {
        setPhases(prev => [...prev, ...morePhases]);
        setIsCompleted(false);
        setCurrentPhaseIdx(phases.length); // Jump to the first new phase
      }
    } catch (err) {
      console.error('Failed to generate more practice', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const currentPhase = phases[currentPhaseIdx];

  // Get phase label info
  const getPhaseIcon = (type: string) => {
    if (type === 'teaching') return { icon: BookOpen, label: 'LEARN', color: 'text-emerald-400' };
    if (type === 'quiz') return { icon: HelpCircle, label: 'QUIZ', color: 'text-amber-400' };
    return { icon: Code, label: 'CODE', color: 'text-blue-400' };
  };

  // ===== LOADING STATE =====
  if (initialLoading) {
    return (
      <div className="fixed inset-0 z-[90] bg-[#1e1e1e] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
        <p className="text-zinc-400 animate-pulse">Preparing your lesson...</p>
        <p className="text-[10px] text-zinc-600">This usually takes 5-10 seconds</p>
      </div>
    );
  }

  // ===== ERROR STATE =====
  if (error) {
    const isQuota = error.includes('Quota');
    return (
      <div className="fixed inset-0 z-[90] bg-[#1e1e1e] flex flex-col items-center justify-center space-y-6 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
          <XCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">Oops! Something went wrong</h3>
          <p className="text-zinc-400 max-w-md">{error}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onClose} className="px-6 py-2 bg-[#333] hover:bg-[#444] text-white rounded-xl font-bold transition-all">Go Back</button>
          {isQuota ? (
            <button onClick={onOpenSettings} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2">
              <Settings className="w-4 h-4" /> Open Settings
            </button>
          ) : (
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentPhase) return null;

  // ===== COMPLETED STATE =====
  if (isCompleted) {
    return (
      <div className="fixed inset-0 z-[90] bg-[#1e1e1e] flex flex-col items-center justify-center space-y-6 p-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4">
          <Sparkles className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Lesson Complete! 🎉</h2>
          <p className="text-zinc-400 max-w-md">{completionMsg}</p>
          <p className="text-sm text-emerald-400 font-bold">You completed {phases.length} phases</p>
        </motion.div>
        <div className="flex gap-4">
          <button onClick={onClose} className="px-6 py-3 bg-[#333] hover:bg-[#444] text-white rounded-xl font-bold transition-all">
            Exit Learning Mode
          </button>
          <button onClick={handleNextChunk} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Teach Next Part
          </button>
        </div>
      </div>
    );
  }

  const phaseInfo = getPhaseIcon(currentPhase.type);

  // ===== MAIN LEARNING VIEW =====
  return (
    <div className="fixed inset-0 z-[90] bg-[#1e1e1e] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-[#333] flex items-center justify-between px-6 bg-[#252526] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                Phase {currentPhaseIdx + 1} of {phases.length}{bgLoading ? '+' : ''}
              </p>
              {bgLoading && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] text-zinc-600 uppercase font-bold">Loading more...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phase progress dots */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {phases.map((p, i) => {
              const info = getPhaseIcon(p.type);
              return (
                <div key={i} className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  p.type === 'teaching' && "rounded-sm",
                  p.type === 'coding' && "rounded-none",
                  i < currentPhaseIdx ? "bg-emerald-500" :
                  i === currentPhaseIdx ? "bg-emerald-400 ring-2 ring-emerald-400/30 animate-pulse" : "bg-zinc-700"
                )} title={`${info.label} - ${i + 1}`} />
              );
            })}
          </div>

          <div className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border",
            currentPhase.type === 'teaching' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            currentPhase.type === 'quiz' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
            currentPhase.type === 'coding' && "bg-blue-500/10 text-blue-400 border-blue-500/20"
          )}>
            {phaseInfo.label}
          </div>

          <button onClick={() => {
            if (confirm('Reset your PIN?')) { localStorage.removeItem('learning_pin'); onClose(); }
          }} className="px-3 py-1.5 hover:bg-white/5 text-zinc-500 hover:text-zinc-300 text-[10px] font-bold rounded-lg transition-all flex items-center gap-2">
            <RefreshCw className="w-3 h-3" /> Reset PIN
          </button>
          <button onClick={() => setShowExitPin(true)}
            className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-all flex items-center gap-2">
            <Lock className="w-3 h-3" /> Exit Learning Mode
          </button>
        </div>
      </div>

      {/* Phase Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={`${currentPhaseIdx}-${currentPhase.type}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }} className="h-full">
            {currentPhase.type === 'teaching' && (
              <TeachingView phase={currentPhase.data as TeachingPhase} onContinue={goNext} />
            )}
            {currentPhase.type === 'quiz' && (
              <QuizView phase={currentPhase.data as QuizPhase} onContinue={goNext} onReteach={goReteach} />
            )}
            {currentPhase.type === 'coding' && (
              <CodingView challenge={currentPhase.data as CodingChallenge} language={activeFile?.language || 'javascript'} onComplete={goNext} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Waiting for background content */}
      {currentPhaseIdx === phases.length - 1 && bgLoading && (
        <div className="h-10 border-t border-[#333] flex items-center justify-center gap-2 bg-[#252526]">
          <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
          <span className="text-[10px] text-zinc-500 font-bold">Loading next phases...</span>
        </div>
      )}

      {/* Exit PIN Modal */}
      <AnimatePresence>
        {showExitPin && (
          <PinSystem mode="verify" onSuccess={() => { setShowExitPin(false); onClose(); }} onCancel={() => setShowExitPin(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
