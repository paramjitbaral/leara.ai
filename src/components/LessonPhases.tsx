import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, CheckCircle2, XCircle, Lightbulb, ChevronRight, ChevronDown, Code, Send, Loader2, Eye, RotateCcw, Sparkles, AlertTriangle } from 'lucide-react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { TeachingPhase, QuizPhase, CodingChallenge } from '../types';
import { validateCodingChallenge } from '../services/ai';
import { cn } from '../lib/utils';

// ============ TEACHING PHASE VIEW ============
// Shows code with auto-stepping line annotations — like a teacher on a whiteboard
export function TeachingView({ phase, onContinue }: { phase: TeachingPhase; onContinue: () => void }) {
  const annotations = phase.lineAnnotations || [];

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        
        {/* Top Header & Analogy */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-white">
            {phase.title === 'Analyzing Code...' ? (
              <span className="flex items-center gap-3">
                Analyzing Code <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
              </span>
            ) : phase.title}
          </h2>
          
          {phase.analogy ? (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-lg mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                </div>
                <h4 className="font-bold text-amber-400 text-sm tracking-wide uppercase">The Analogy</h4>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-zinc-200 leading-relaxed italic">
                <ReactMarkdown>{phase.analogy}</ReactMarkdown>
              </div>
            </div>
          ) : phase.title === 'Analyzing Code...' && (
            <div className="p-5 rounded-2xl bg-zinc-800/50 border border-[#333] animate-pulse mb-6">
              <div className="h-4 w-32 bg-zinc-700 rounded mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-zinc-700/50 rounded" />
                <div className="h-3 w-5/6 bg-zinc-700/50 rounded" />
              </div>
            </div>
          )}
        </motion.div>

        {/* Concept Explanation */}
        {phase.conceptExplanation ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="p-5 rounded-xl border border-[#333] bg-[#252526] shadow-xl">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> What you need to know
            </p>
            <div className="text-sm text-zinc-300 leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{phase.conceptExplanation}</ReactMarkdown>
            </div>
          </motion.div>
        ) : phase.title === 'Analyzing Code...' && (
          <div className="p-5 rounded-xl border border-[#333] bg-[#252526] animate-pulse">
            <div className="h-3 w-40 bg-zinc-700 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-zinc-700/50 rounded" />
              <div className="h-3 w-full bg-zinc-700/50 rounded" />
              <div className="h-3 w-2/3 bg-zinc-700/50 rounded" />
            </div>
          </div>
        )}

        {/* Code & Key Points */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-xl overflow-hidden border border-[#333]">
          
          {/* Code Display */}
          <div className="bg-[#0d1117] p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Code className="w-3 h-3" /> Code Being Taught
            </p>
            <div className="font-mono text-sm leading-relaxed overflow-x-auto">
              {phase.codeSnippet?.split('\n').map((line, lineIdx) => (
                <div key={lineIdx} className="flex items-start gap-3 px-2 py-0.5 rounded">
                  <span className="text-zinc-600 text-xs w-5 text-right select-none shrink-0 pt-0.5">{lineIdx + 1}</span>
                  <pre className="text-zinc-300 whitespace-pre-wrap flex-1">{line || ' '}</pre>
                </div>
              ))}
            </div>
          </div>

          {/* Important Points List */}
          {annotations.length > 0 && (
            <div className="bg-[#161b22] border-t border-[#333] p-4">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">Key Points</p>
              <div className="space-y-4">
                {annotations.map((ann, idx) => (
                  <div key={idx} className="bg-[#1e1e1e] border border-[#333] rounded-lg p-3">
                    <div className="flex flex-col gap-2">
                      {ann.code && (
                        <code className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-fit">{ann.code}</code>
                      )}
                      <p className="text-sm text-zinc-300"><span className="font-bold text-emerald-400">What it does:</span> {ann.explanation}</p>
                      {ann.whyNeeded && (
                        <p className="text-sm text-zinc-400"><span className="font-bold text-amber-400">Why it's needed:</span> {ann.whyNeeded}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Key Takeaway */}
        {phase.keyTakeaway && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">💡 Key Takeaway</p>
            <p className="text-sm text-zinc-300 font-medium">{phase.keyTakeaway}</p>
          </motion.div>
        )}
      </div>

      {/* Footer Nav */}
      <div className="h-16 border-t border-[#333] bg-[#252526] flex items-center justify-between px-6 shrink-0">
        <p className="text-xs text-zinc-500">
          {phase.title === 'Analyzing Code...' ? 'Professor Leara is thinking...' : 'Read through the explanation above'}
        </p>
        <button
          onClick={onContinue}
          disabled={phase.title === 'Analyzing Code...'}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all flex items-center gap-2"
        >
          {phase.title === 'Analyzing Code...' ? (
            <>Preparing... <Loader2 className="w-4 h-4 animate-spin" /></>
          ) : (
            <>I understand, let's practice <BookOpen className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ============ QUIZ PHASE VIEW ============
// Adaptive: if student fails, shows re-teaching before moving on
export function QuizView({ phase, onContinue, onReteach }: { phase: QuizPhase; onContinue: () => void; onReteach?: () => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const questions = phase.questions || [];
  const q = questions[currentQ];

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.correctIndex) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setDone(true);
    }
  };

  if (!q) return <div className="p-6 text-zinc-400">No questions available.</div>;

  if (done) {
    const passed = score >= Math.ceil(questions.length / 2);
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 space-y-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4">
          <div className={cn("w-16 h-16 mx-auto rounded-full flex items-center justify-center border",
            passed ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"
          )}>
            {passed ? <CheckCircle2 className="w-8 h-8 text-emerald-400" /> : <AlertTriangle className="w-8 h-8 text-amber-400" />}
          </div>
          <h3 className="text-xl font-bold text-white">
            {passed ? 'Great job! 🎉' : 'Let\'s review that again 📖'}
          </h3>
          <p className="text-zinc-400">
            You scored <span className={cn("font-bold", passed ? "text-emerald-400" : "text-amber-400")}>{score}/{questions.length}</span>
          </p>
        </motion.div>

        {passed ? (
          <button onClick={onContinue}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
            Continue to Practice <Code className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-3">
            {onReteach && (
              <button onClick={onReteach}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                <RotateCcw className="w-4 h-4" /> Review Again
              </button>
            )}
            <button onClick={() => { setCurrentQ(0); setSelected(null); setAnswered(false); setScore(0); setDone(false); }}
              className="px-6 py-3 bg-[#333] hover:bg-[#444] text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
              Retry Quiz
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
          Question {currentQ + 1} of {questions.length}
        </p>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full", i < currentQ ? "bg-emerald-500" : i === currentQ ? "bg-emerald-400 animate-pulse" : "bg-zinc-700")} />
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <h3 className="text-base font-bold text-white leading-relaxed">{q.question}</h3>
        <div className="space-y-2">
          {q.options?.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
            const isSelected = i === selected;
            return (
              <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => handleSelect(i)}
                className={cn("w-full p-3 rounded-xl border text-left text-sm transition-all flex items-center gap-3",
                  !answered && "bg-[#1e1e1e] border-[#333] hover:border-emerald-500/30 text-zinc-300",
                  answered && isCorrect && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                  answered && isSelected && !isCorrect && "bg-red-500/10 border-red-500/30 text-red-300",
                  answered && !isSelected && !isCorrect && "opacity-40 bg-[#1e1e1e] border-[#333] text-zinc-500"
                )}>
                <span className={cn("w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0",
                  !answered && "border-zinc-600 text-zinc-500",
                  answered && isCorrect && "border-emerald-500 text-emerald-400 bg-emerald-500/10",
                  answered && isSelected && !isCorrect && "border-red-500 text-red-400 bg-red-500/10"
                )}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </motion.button>
            );
          })}
        </div>

        {answered && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={cn("p-3 rounded-xl border text-xs leading-relaxed",
              selected === q.correctIndex ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300" : "bg-red-500/5 border-red-500/20 text-red-300"
            )}>
            {selected !== q.correctIndex && <p className="font-bold text-red-400 mb-1">The correct answer was: {q.options[q.correctIndex]}</p>}
            {q.explanation}
          </motion.div>
        )}
      </div>

      {answered && (
        <div className="pt-4">
          <button onClick={handleNext}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all">
            {currentQ < questions.length - 1 ? 'Next Question' : 'See Results'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ CODING CHALLENGE VIEW ============
export function CodingView({ challenge, language, onComplete }: { challenge: CodingChallenge; language: string; onComplete: () => void }) {
  const [code, setCode] = useState(challenge.starterCode || '');
  const [result, setResult] = useState<{ correct: boolean; feedback: string; hint?: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [hintIdx, setHintIdx] = useState(-1);
  const [attempts, setAttempts] = useState(0);

  const handleMount: OnMount = (editor) => {
    editor.onKeyDown((e: any) => {
      if ((e.ctrlKey || e.metaKey) && (e.keyCode === 31 || e.keyCode === 52 || e.keyCode === 33)) e.preventDefault();
    });
  };

  const handleSubmit = async () => {
    setValidating(true);
    setAttempts(a => a + 1);
    try {
      const res = await validateCodingChallenge(challenge.instruction, code, challenge.expectedCode, language);
      setResult(res);
      if (res.correct) setTimeout(onComplete, 2000);
    } catch { setResult({ correct: false, feedback: "Couldn't check right now. Try again!" }); }
    finally { setValidating(false); }
  };

  const handleShowAnswer = () => {
    setCode(challenge.expectedCode);
    setResult({ correct: true, feedback: "Here's the correct solution — study it carefully! 📖" });
    setTimeout(onComplete, 3000);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Instructions Panel */}
      <div className="p-4 border-b border-[#333] space-y-3 bg-[#252526]">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Code className="w-4 h-4 text-emerald-400" /> {challenge.title}
        </h3>
        <p className="text-xs text-zinc-300 leading-relaxed">{challenge.instruction}</p>
        
        <div className="flex items-center gap-2 flex-wrap">
          {challenge.hints?.length > 0 && hintIdx < challenge.hints.length - 1 && (
            <button onClick={() => setHintIdx(h => h + 1)}
              className="text-[10px] px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg font-bold hover:bg-amber-500/20 transition-all flex items-center gap-1">
              <Eye className="w-3 h-3" /> Show Hint ({hintIdx + 2}/{challenge.hints.length})
            </button>
          )}
          {/* After 3 failed attempts, offer to show the answer */}
          {attempts >= 3 && !result?.correct && (
            <button onClick={handleShowAnswer}
              className="text-[10px] px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg font-bold hover:bg-blue-500/20 transition-all flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Show Answer
            </button>
          )}
        </div>

        {hintIdx >= 0 && (
          <div className="p-2 bg-amber-500/5 border border-amber-500/15 rounded-lg">
            <p className="text-xs text-amber-300">💡 {challenge.hints[hintIdx]}</p>
          </div>
        )}
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className={cn("p-3 rounded-xl border flex gap-2",
              result.correct ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20")}>
            {result.correct ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <div>
              <p className={cn("text-xs font-bold", result.correct ? "text-emerald-400" : "text-red-400")}>
                {result.correct ? '✅ Correct!' : '❌ Not quite...'}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">{result.feedback}</p>
              {result.hint && <p className="text-xs text-amber-300 mt-1">💡 {result.hint}</p>}
            </div>
          </motion.div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <MonacoEditor height="100%" language={language} theme="vs-dark" value={code} onMount={handleMount}
          onChange={(v) => setCode(v || '')}
          options={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", minimap: { enabled: false }, scrollBeyondLastLine: false,
            automaticLayout: true, padding: { top: 16 }, tabSize: 2, wordWrap: 'on', contextmenu: false }} />
        <div className="absolute bottom-6 right-6 flex gap-2">
          <button onClick={() => setCode(challenge.starterCode || '')}
            className="px-4 py-2.5 bg-[#333] hover:bg-[#444] text-zinc-400 rounded-xl font-bold shadow-xl flex items-center gap-2 transition-all text-sm">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button onClick={handleSubmit} disabled={validating}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-xl flex items-center gap-2 transition-all active:scale-95 text-sm">
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Code
          </button>
        </div>
      </div>
    </div>
  );
}
