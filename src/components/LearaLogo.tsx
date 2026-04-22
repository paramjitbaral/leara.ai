import React from 'react';
import { Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface LearaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export function LearaLogo({ size = 'md', className, showText = true }: LearaLogoProps) {
  const { theme } = useStore();
  
  const sizeClasses = {
    sm: { container: "w-8 h-8", icon: "w-4 h-4", text: "text-lg" },
    md: { container: "w-10 h-10", icon: "w-6 h-6", text: "text-xl" },
    lg: { container: "w-12 h-12", icon: "w-8 h-8", text: "text-2xl" }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={cn("flex items-center gap-3 shrink-0", className)}>
      <div className={cn("relative transition-transform hover:scale-105", currentSize.container)}>
        <img 
          src="/logo.png" 
          className="w-full h-full object-contain absolute inset-0 z-10" 
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
            if (fallback) (fallback as HTMLElement).style.display = 'flex';
          }}
          alt="Leara.ai"
        />
        <div className={cn(
          "logo-fallback absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl hidden items-center justify-center text-white shadow-lg shadow-emerald-500/20",
          currentSize.container
        )}>
          <Zap className={currentSize.icon} />
        </div>
      </div>
      
      {showText && (
        <h1 className={cn(
          "font-bold tracking-tighter",
          currentSize.text,
          theme === 'dark' ? "text-white" : "text-zinc-900"
        )}>
          <span className="text-sky-500">Leara</span><span className="text-emerald-500">.ai</span>
        </h1>
      )}
    </div>
  );
}
