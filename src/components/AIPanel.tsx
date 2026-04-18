import React, { useState, useEffect } from 'react';
import { FileData, Explanation, Exercise } from '../types';
import { toast } from 'sonner';
import { explainCode, generateExercises, validateAnswer } from '../services/ai';
import { Sparkles, BookOpen, BrainCircuit, CheckCircle2, XCircle, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface AIPanelProps {
  activeFile: FileData | null;
  onSetHighlight: (range: { start: number; end: number; label?: string } | null) => void;
}

export function AIPanel({ activeFile, onSetHighlight }: AIPanelProps) {
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'explain' | 'practice'>('explain');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [predictionAnswer, setPredictionAnswer] = useState<string | null>(null);
  const [currentExecutionStep, setCurrentExecutionStep] = useState(0);
  const [experimentAnswer, setExperimentAnswer] = useState('');
  const [debugAnswer, setDebugAnswer] = useState('');
  const [isDebugCorrect, setIsDebugCorrect] = useState<boolean | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<Record<string, { correct: boolean; feedback: string }>>({});
  const [validating, setValidating] = useState<string | null>(null);
  const [userReflection, setUserReflection] = useState('');
  const [isReflectionSubmitted, setIsReflectionSubmitted] = useState(false);
  const [performanceScore, setPerformanceScore] = useState(0);

  const handleExplain = async () => {
    if (!activeFile) return;
    setLoading(true);
    try {
      const data = await explainCode(activeFile.content, activeFile.language);
      setExplanation(data);
      setCurrentStep(1);
      // Reset practice when code changes
      setExercises([]);
      setValidationResults({});
      setUserAnswers({});
      setUserReflection('');
      setIsReflectionSubmitted(false);
    } catch (err: any) {
      console.error('Explanation failed:', err);
      toast.error(err.message || 'Explanation failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    const next = Math.min(currentStep + 1, 12);
    setCurrentStep(next);
    onSetHighlight(null);
  };

  const isStepLocked = () => {
    if (!explanation) return true;
    switch (currentStep) {
      case 3: return false; // STOP after Step 3
      case 4: return !predictionAnswer; // STOP after Step 4 (Prediction)
      case 5: return currentExecutionStep < explanation.executionSteps.length - 1; // STOP after Step 5 (Execution)
      case 6: return experimentAnswer.trim().length < 5; // STOP after Step 6 (Experiment)
      case 7: return !isDebugCorrect; // STOP after Step 7 (Debug)
      case 9: return !isReflectionSubmitted; // STOP after Step 9 (Reflection)
      default: return false;
    }
  };

  const checkDebug = () => {
    if (!explanation) return;
    const isCorrect = debugAnswer.trim().toLowerCase() === explanation.debugTask.solution.trim().toLowerCase();
    setIsDebugCorrect(isCorrect);
  };
  const handlePractice = async () => {
    if (!activeFile) return;
    setLoading(true);
    try {
      // Adaptive difficulty based on performanceScore
      const isStruggling = performanceScore < 0;
      const data = await generateExercises(activeFile.content, activeFile.language, isStruggling);
      setExercises(data);
      setActiveTab('practice');
    } catch (err: any) {
      console.error('Exercise generation failed:', err);
      toast.error(err.message || 'Exercise generation failed');
    } finally {
      setLoading(false);
    }
  };

  const checkAnswer = async (exercise: Exercise) => {
    const answer = userAnswers[exercise.id];
    if (!answer) return;
    setValidating(exercise.id);
    try {
      const result = await validateAnswer(exercise.question, answer, exercise.correctAnswer);
      setValidationResults(prev => ({ ...prev, [exercise.id]: result }));
      
      // Update performance score
      setPerformanceScore(prev => result.correct ? prev + 1 : prev - 1);
    } catch (err: any) {
      console.error('Validation failed:', err);
      toast.error(err.message || 'Validation failed');
    } finally {
      setValidating(null);
    }
  };

  const submitReflection = () => {
    if (userReflection.trim().length > 10) {
      setIsReflectionSubmitted(true);
      setPerformanceScore(prev => prev + 1);
    }
  };

  const isFocusLocked = currentStep === 3 && (!isReflectionSubmitted || Object.keys(validationResults).length < exercises.length);

  useEffect(() => {
    setExplanation(null);
    setExercises([]);
    setValidationResults({});
    setUserAnswers({});
    setCurrentStep(1);
    setPredictionAnswer(null);
    setCurrentExecutionStep(0);
    setExperimentAnswer('');
    setDebugAnswer('');
    setIsDebugCorrect(null);
    setUserReflection('');
    setIsReflectionSubmitted(false);
    setPerformanceScore(0);
    onSetHighlight(null);
  }, [activeFile, onSetHighlight]);

  if (!activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-white">AI Learning Assistant</h3>
        <p className="text-sm text-zinc-500">Select a file to get explanations and practice exercises.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#252526]">
      {/* Tabs */}
      <div className="flex border-b border-[#333333] shrink-0">
        <button 
          onClick={() => setActiveTab('explain')}
          className={cn(
            "flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
            activeTab === 'explain' ? "text-emerald-400 border-b-2 border-emerald-400 bg-[#1e1e1e]" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Explain
        </button>
        <button 
          onClick={() => {
            if (exercises.length === 0) handlePractice();
            else setActiveTab('practice');
          }}
          className={cn(
            "flex-1 py-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
            activeTab === 'practice' ? "text-emerald-400 border-b-2 border-emerald-400 bg-[#1e1e1e]" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          Practice
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'explain' ? (
          <div className="space-y-6">
            {!explanation && !loading && (
              <button 
                onClick={() => handleExplain()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                Explain Code
              </button>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm text-zinc-500 animate-pulse">Analyzing code structure...</p>
              </div>
            )}

            {explanation && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Step 1: Summary */}
                <section className="space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 1: Simple Summary</h4>
                  <ul className="space-y-2">
                    {explanation.summary.map((bullet, i) => (
                      <li key={i} className="text-sm text-zinc-300 flex gap-2">
                        <span className="text-emerald-500">•</span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Step 2: Visual Flow */}
                {currentStep >= 2 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 2: Visual Flow</h4>
                    <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333333] flex items-center gap-3 text-sm font-mono text-emerald-400 overflow-x-auto no-scrollbar">
                      <div className="flex items-center gap-3 min-w-max mx-auto">
                        {explanation.visualFlow.split('->').map((part, i, arr) => (
                          <React.Fragment key={i}>
                            <span className="px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20 whitespace-nowrap">
                              {part.trim()}
                            </span>
                            {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </motion.section>
                )}                {/* Step 3: One Block */}
                {currentStep >= 3 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Step 3: One Block Explanation</h4>
                      <div className="flex items-center gap-2 px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <span className="text-[9px] font-bold text-amber-400 uppercase">Teaching Mode</span>
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333333] space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded border border-amber-500/20">
                          {explanation.mainBlock.name}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {explanation.mainBlock.bullets.map((bullet, i) => (
                          <motion.div 
                            key={i} 
                            onMouseEnter={() => onSetHighlight({ ...bullet.lineRange, label: bullet.text })}
                            onMouseLeave={() => onSetHighlight(null)}
                            className="group cursor-help p-2 rounded-lg hover:bg-amber-500/5 transition-all border border-transparent hover:border-amber-500/20"
                          >
                            <div className="flex gap-3">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold flex items-center justify-center border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                                {i + 1}
                              </span>
                              <p className="text-sm text-zinc-300 leading-relaxed group-hover:text-white transition-colors">
                                {bullet.text}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.section>
                )}

                {/* Step 4: Prediction Mode */}
                {currentStep >= 4 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 4: Prediction Mode</h4>
                    <p className="text-sm text-zinc-300 font-medium">{explanation.prediction.question}</p>
                    <div className="grid grid-cols-1 gap-2">
                      {explanation.prediction.options.map((option, i) => (
                        <button
                          key={i}
                          onClick={() => setPredictionAnswer(option)}
                          className={cn(
                            "p-3 text-left text-sm rounded-lg border transition-all",
                            predictionAnswer === option 
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                              : "bg-[#1e1e1e] border-[#333333] text-zinc-400 hover:border-zinc-600"
                          )}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {predictionAnswer && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2">
                        <p className={cn(
                          "text-xs font-bold mb-1",
                          predictionAnswer === explanation.prediction.correctAnswer ? "text-emerald-400" : "text-red-400"
                        )}>
                          {predictionAnswer === explanation.prediction.correctAnswer ? "Correct!" : "Not quite."}
                        </p>
                        <p className="text-xs text-zinc-500">{explanation.prediction.explanation}</p>
                      </motion.div>
                    )}
                  </motion.section>
                )}

                {/* Step 5: Step-by-Step Execution */}
                {currentStep >= 5 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 5: Execution Simulation</h4>
                    <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333333] space-y-4">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold">
                        <span>Step {currentExecutionStep + 1} of {explanation.executionSteps.length}</span>
                        <div className="flex gap-1">
                          {explanation.executionSteps.map((_, i) => (
                            <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i <= currentExecutionStep ? "bg-emerald-500" : "bg-[#333333]")} />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-mono rounded border border-emerald-500/20">
                            Line {explanation.executionSteps[currentExecutionStep].line}
                          </span>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {explanation.executionSteps[currentExecutionStep].description}
                          </p>
                        </div>

                        {Object.keys(explanation.executionSteps[currentExecutionStep].variables).length > 0 && (
                          <div className="p-3 bg-[#0d0d0d] rounded-lg border border-[#222] space-y-1">
                            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Variables</p>
                            {Object.entries(explanation.executionSteps[currentExecutionStep].variables).map(([key, val]) => (
                              <div key={key} className="flex justify-between text-xs font-mono">
                                <span className="text-zinc-500">{key}:</span>
                                <span className="text-emerald-400">{JSON.stringify(val)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const next = Math.max(0, currentExecutionStep - 1);
                            setCurrentExecutionStep(next);
                            onSetHighlight({ start: explanation.executionSteps[next].line, end: explanation.executionSteps[next].line });
                          }}
                          disabled={currentExecutionStep === 0}
                          className="flex-1 py-1.5 bg-[#333333] hover:bg-[#444444] disabled:opacity-30 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => {
                            const next = Math.min(explanation.executionSteps.length - 1, currentExecutionStep + 1);
                            setCurrentExecutionStep(next);
                            onSetHighlight({ start: explanation.executionSteps[next].line, end: explanation.executionSteps[next].line });
                          }}
                          disabled={currentExecutionStep === explanation.executionSteps.length - 1}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Next Step
                        </button>
                      </div>
                    </div>
                  </motion.section>
                )}

                {/* Step 6: Edit & Experiment */}
                {currentStep >= 6 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Step 6: Experiment Mode</h4>
                    <p className="text-sm text-zinc-300 font-medium">{explanation.experiment.task}</p>
                    <textarea
                      value={experimentAnswer}
                      onChange={(e) => setExperimentAnswer(e.target.value)}
                      placeholder="What do you think will happen if you make this change?"
                      className="w-full h-20 bg-[#1e1e1e] border border-[#333333] rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                    />
                  </motion.section>
                )}

                {/* Step 7: Error / Debug Mode */}
                {currentStep >= 7 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-red-400">Step 7: Debug Mode</h4>
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-4">
                      <p className="text-sm text-zinc-300">{explanation.debugTask.description}</p>
                      <pre className="p-3 bg-[#0d0d0d] rounded-lg text-xs font-mono text-red-400 border border-red-500/20">
                        {explanation.debugTask.buggyCode}
                      </pre>
                      <div className="space-y-2">
                        <input
                          value={debugAnswer}
                          onChange={(e) => setDebugAnswer(e.target.value)}
                          placeholder="How would you fix this?"
                          className="w-full bg-[#1e1e1e] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500 transition-colors"
                        />
                        <button
                          onClick={checkDebug}
                          className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Check Fix
                        </button>
                        {isDebugCorrect !== null && (
                          <p className={cn("text-xs font-bold", isDebugCorrect ? "text-emerald-400" : "text-red-400")}>
                            {isDebugCorrect ? "Great catch! That fixes it." : "Not quite right. Try again!"}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.section>
                )}

                {/* Step 8: Practice Mode */}
                {currentStep >= 8 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 8: Practice Mode</h4>
                    
                    {/* Fill in Code */}
                    <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333333] space-y-3">
                      <p className="text-xs font-bold text-zinc-500 uppercase">Task 1: Fill the missing part</p>
                      <pre className="p-3 bg-[#0d0d0d] rounded-lg text-xs font-mono text-emerald-400">
                        {explanation.practice.fillInCode.template.replace('___', '______')}
                      </pre>
                      <input
                        placeholder="What goes in the blank?"
                        className="w-full bg-[#252526] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                        onChange={(e) => {
                          if (e.target.value.trim() === explanation.practice.fillInCode.answer) {
                            setPerformanceScore(p => p + 1);
                          }
                        }}
                      />
                    </div>

                    {/* Logic Question */}
                    <div className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333333] space-y-3">
                      <p className="text-xs font-bold text-zinc-500 uppercase">Task 2: Logic Question</p>
                      <p className="text-sm text-zinc-300">{explanation.practice.logicQuestion.question}</p>
                      <input
                        placeholder="Your answer..."
                        className="w-full bg-[#252526] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </motion.section>
                )}

                {/* Step 9: Understanding Check */}
                {currentStep >= 9 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-4"
                  >
                    <div className="flex items-center gap-2 text-emerald-400">
                      <BrainCircuit className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-widest">Step 9: Understanding Check</h4>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-300 font-medium">Explain this logic in your own words:</p>
                      <textarea 
                        value={userReflection}
                        onChange={(e) => setUserReflection(e.target.value)}
                        placeholder="Type your explanation here..."
                        className="w-full h-24 bg-[#1e1e1e] border border-[#333333] rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                      />
                      {!isReflectionSubmitted ? (
                        <button 
                          onClick={submitReflection}
                          disabled={userReflection.trim().length < 10}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Submit Explanation
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          Reflection accepted!
                        </div>
                      )}
                    </div>
                  </motion.section>
                )}

                {/* Step 10: DSA Connection */}
                {currentStep >= 10 && explanation.dsa && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 10: DSA Connection</h4>
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {explanation.dsa.categories.map(cat => (
                          <span key={cat} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded uppercase">{cat}</span>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Technique</p>
                          <p className="text-sm text-zinc-300">{explanation.dsa.technique}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Time</p>
                            <p className="text-sm font-mono text-emerald-400">{explanation.dsa.timeComplexity}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Space</p>
                            <p className="text-sm font-mono text-emerald-400">{explanation.dsa.spaceComplexity}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.section>
                )}

                {/* Step 11: Real-World Connection */}
                {currentStep >= 11 && (
                  <motion.section 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Step 11: Real-World Connection</h4>
                    <ul className="space-y-2">
                      {explanation.realWorldConnection.map((bullet, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex gap-2">
                          <span className="text-emerald-500">•</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </motion.section>
                )}

                {/* Step 12: Mini Recap */}
                {currentStep >= 12 && (
                  <motion.section 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-4"
                  >
                    <h4 className="text-sm font-bold text-emerald-400">What you learned:</h4>
                    <ul className="space-y-2">
                      {explanation.miniRecap.map((bullet, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex gap-2">
                          <span className="text-emerald-500">✓</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-2 text-center">
                      <p className="text-xs text-emerald-400 font-bold">"Ohhh I understand this now!"</p>
                    </div>
                  </motion.section>
                )}

                {/* Next Step Button */}
                {currentStep < 12 && (
                  <button 
                    onClick={nextStep}
                    disabled={isStepLocked()}
                    className={cn(
                      "w-full py-2 border rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                      isStepLocked() 
                        ? "border-zinc-800 text-zinc-600 cursor-not-allowed" 
                        : "border-[#444444] hover:bg-[#333333] text-zinc-300"
                    )}
                  >
                    {currentStep === 1 ? 'Show Visual Flow' : 
                     currentStep === 2 ? 'Show One Block' : 
                     currentStep === 3 ? 'Enter Prediction Mode' :
                     currentStep === 4 ? 'Start Execution Simulation' :
                     currentStep === 5 ? 'Try Experiment' :
                     currentStep === 6 ? 'Enter Debug Mode' :
                     currentStep === 7 ? 'Go to Practice' :
                     currentStep === 8 ? 'Check Understanding' :
                     currentStep === 9 ? 'Show DSA Connection' :
                     currentStep === 10 ? 'Show Real-World Connection' :
                     'Show Mini Recap'}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {exercises.length === 0 && !loading && (
              <button 
                onClick={handlePractice}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <BrainCircuit className="w-4 h-4" />
                Generate Exercises
              </button>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm text-zinc-500 animate-pulse">Creating custom challenges...</p>
              </div>
            )}

            <div className="space-y-4">
              {exercises.map((ex, i) => (
                <motion.div 
                  key={ex.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 bg-[#1e1e1e] rounded-xl border border-[#333333] space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Exercise {i+1}</span>
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] rounded uppercase font-bold">{ex.type}</span>
                  </div>
                  
                  <p className="text-sm text-zinc-300 font-medium">{ex.question}</p>
                  
                  {ex.codeTemplate && (
                    <pre className="p-3 bg-[#0d0d0d] rounded-lg text-xs font-mono text-emerald-400 border border-[#222]">
                      {ex.codeTemplate}
                    </pre>
                  )}

                  <div className="space-y-2">
                    <input 
                      value={userAnswers[ex.id] || ''}
                      onChange={e => setUserAnswers(prev => ({ ...prev, [ex.id]: e.target.value }))}
                      placeholder="Your answer..."
                      className="w-full bg-[#252526] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                    />
                    
                    {validationResults[ex.id] ? (
                      <div className={cn(
                        "p-3 rounded-lg text-xs flex gap-3",
                        validationResults[ex.id].correct ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                      )}>
                        {validationResults[ex.id].correct ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                        <p>{validationResults[ex.id].feedback}</p>
                      </div>
                    ) : (
                      <button 
                        onClick={() => checkAnswer(ex)}
                        disabled={validating === ex.id}
                        className="w-full py-2 bg-[#333333] hover:bg-[#444444] text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {validating === ex.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Check Answer'}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
