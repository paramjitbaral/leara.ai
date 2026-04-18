import React from 'react';
import { CheckCircle2, Circle, Calendar, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface Day {
  number: number;
  title: string;
  description: string;
  fileId?: string;
}

interface LearningPathProps {
  completedDays: number[];
  onDayClick: (day: Day) => void;
}

const DAYS: Day[] = [
  { number: 1, title: 'Project Overview', description: 'Understand the goal and structure.' },
  { number: 2, title: 'Core Logic', description: 'Implement the main functions.' },
  { number: 3, title: 'Data Handling', description: 'Manage variables and storage.' },
  { number: 4, title: 'UI & Interaction', description: 'Connect logic to the interface.' },
  { number: 5, title: 'Final Polish', description: 'Refactor and optimize code.' },
];

export function LearningPath({ completedDays, onDayClick }: LearningPathProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
        <Calendar className="w-3 h-3" />
        <span>Learning Path</span>
      </div>

      <div className="space-y-2">
        {DAYS.map((day) => (
          <button
            key={day.number}
            onClick={() => onDayClick(day)}
            className={cn(
              "w-full p-3 rounded-xl border text-left transition-all group",
              completedDays.includes(day.number)
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-[#1e1e1e] border-[#333333] hover:border-[#444444]"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                completedDays.includes(day.number) ? "text-emerald-400" : "text-zinc-500"
              )}>
                Day {day.number}
              </span>
              {completedDays.includes(day.number) ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Circle className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500" />
              )}
            </div>
            <h5 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
              {day.title}
            </h5>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{day.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
