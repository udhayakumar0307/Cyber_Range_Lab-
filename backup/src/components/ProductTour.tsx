import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import type { TourStep } from '../data/tourSteps';

interface ProductTourProps {
  steps: TourStep[];
  onClose: () => void;
}

export const ProductTour: React.FC<ProductTourProps> = ({ steps, onClose }) => {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#0052CC] dark:text-blue-400 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-black text-slate-900 dark:text-white">{step.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{step.description}</p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-[#0052CC]' : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  onClick={() => setIndex((i) => i - 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Previous"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
                className="px-4 py-2 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isLast ? 'Finish' : 'Next'}
                {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
