import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, X, Delete, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

interface PinSystemProps {
  mode: 'create' | 'verify';
  onSuccess: (pin: string) => void;
  onCancel: () => void;
}

export function PinSystem({ mode, onSuccess, onCancel }: PinSystemProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState(false);

  const handleNumber = (num: string) => {
    setPin(prev => prev.length < 4 ? prev + num : prev);
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumber(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (pin.length === 4) {
      if (mode === 'create') {
        if (!isConfirming) {
          setConfirmPin(pin);
          setPin('');
          setIsConfirming(true);
        } else {
          if (pin === confirmPin) {
            onSuccess(pin);
          } else {
            setError(true);
            setTimeout(() => {
              setError(false);
              setPin('');
            }, 500);
          }
        }
      } else {
        // Verify mode
        const savedPin = localStorage.getItem('learning_pin') || '1234';
        if (pin === savedPin) {
          onSuccess(pin);
        } else {
          setError(true);
          setTimeout(() => {
            setError(false);
            setPin('');
          }, 500);
        }
      }
    }
  }, [pin, mode, isConfirming, confirmPin, onSuccess]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-[320px] bg-[#1a1a1a] rounded-[32px] border border-[#333333] p-8 flex flex-col items-center space-y-8 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">
              {mode === 'create' 
                ? (isConfirming ? 'Confirm 4-Digit PIN' : 'Create 4-Digit PIN')
                : 'Enter 4-Digit PIN'}
            </h2>
            <p className="text-xs text-zinc-500">Keep your focus locked</p>
          </div>
        </div>

        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={cn(
                "w-3 h-3 rounded-full border-2 transition-all duration-200",
                pin.length > i 
                  ? "bg-emerald-500 border-emerald-500 scale-110" 
                  : "border-zinc-700",
                error && "border-red-500 bg-red-500 animate-shake"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              className="w-16 h-16 rounded-full bg-[#252526] hover:bg-[#333333] active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            onClick={onCancel}
            className="w-16 h-16 rounded-full bg-transparent hover:bg-white/5 active:scale-95 text-zinc-500 hover:text-white transition-all flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={() => handleNumber('0')}
            className="w-16 h-16 rounded-full bg-[#252526] hover:bg-[#333333] active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-full bg-transparent hover:bg-white/5 active:scale-95 text-zinc-500 hover:text-white transition-all flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
