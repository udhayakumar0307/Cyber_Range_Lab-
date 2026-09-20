import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { getGradeColor } from '../utils/grading';

const GRADE_ROWS: [string, string][] = [
  ['O', '90 - 100%'],
  ['A+', '80 - 89%'],
  ['A', '70 - 79%'],
  ['B+', '60 - 69%'],
  ['B', '50 - 59%'],
  ['C', '40 - 49%'],
  ['R', 'Below 40% (Fail)'],
];

// Small info icon that pops open the O/A+/A/B+/B/C/R grade scale on click.
export const GradeScaleInfo: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="align-middle ml-1 text-slate-400 hover:text-[#0052CC] dark:hover:text-blue-400 cursor-pointer"
        aria-label="Grade scale"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2 normal-case">
          <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 pb-1.5">
            Grade Scale
          </p>
          <div className="space-y-1">
            {GRADE_ROWS.map(([grade, range]) => (
              <div key={grade} className="flex items-center justify-between gap-2 px-1">
                <span className={`text-[10px] font-black w-7 text-center py-0.5 rounded-md border ${getGradeColor(grade)}`}>
                  {grade}
                </span>
                <span className="text-[11px] text-slate-600 dark:text-slate-300">{range}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
