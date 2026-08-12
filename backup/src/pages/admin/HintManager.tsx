import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';

export interface LocalHint {
  order_index: number;
  text: string;
  cost_percent: number;
}

interface HintManagerProps {
  hints: LocalHint[];
  onChange: (hints: LocalHint[]) => void;
}

export const HintManager: React.FC<HintManagerProps> = ({ hints, onChange }) => {
  const addHint = () => {
    const newHint: LocalHint = {
      order_index: hints.length,
      text: '',
      cost_percent: 0,
    };
    onChange([...hints, newHint]);
  };

  const removeHint = (index: number) => {
    const updated = hints
      .filter((_, i) => i !== index)
      .map((h, i) => ({ ...h, order_index: i }));
    onChange(updated);
  };

  const updateHintField = (index: number, field: keyof LocalHint, value: any) => {
    const updated = hints.map((h, i) => {
      if (i === index) {
        return { ...h, [field]: value };
      }
      return h;
    });
    onChange(updated);
  };

  const moveHint = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === hints.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...hints];

    // Swap elements
    const temp = updated[index];
    updated[index] = updated[swapIndex];
    updated[swapIndex] = temp;

    // Reset order indices
    const normalized = updated.map((h, i) => ({ ...h, order_index: i }));
    onChange(normalized);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hints & Penalties</span>
        </div>
        <button
          type="button"
          onClick={addHint}
          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Hint
        </button>
      </div>

      {hints.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            No hints added yet. Click "Add Hint" to configure hints with point deductions.
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map((hint, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
            >
              {/* Order Indicator / Reorder buttons */}
              <div className="flex flex-col items-center gap-1 mt-1">
                <span className="text-xs font-bold font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                  #{idx + 1}
                </span>
                <div className="flex gap-0.5 mt-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveHint(idx, 'up')}
                    className="p-1 rounded bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-indigo-500 disabled:opacity-40 transition-colors"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === hints.length - 1}
                    onClick={() => moveHint(idx, 'down')}
                    className="p-1 rounded bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-indigo-500 disabled:opacity-40 transition-colors"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <div className="flex-1 space-y-2">
                <textarea
                  value={hint.text}
                  onChange={(e) => updateHintField(idx, 'text', e.target.value)}
                  placeholder="Enter the hint content to reveal when unlocked..."
                  rows={2}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                  required
                />
                
                {/* Penalty input */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Penalty Cost:
                  </label>
                  <div className="relative rounded-lg shadow-sm w-24">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      step="0.5"
                      value={hint.cost_percent}
                      onChange={(e) => updateHintField(idx, 'cost_percent', parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 pl-2.5 pr-6 py-2 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      required
                    />
                    <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-xs font-bold text-slate-400">
                      %
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                    deducted from participant payout
                  </span>
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeHint(idx)}
                className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 mt-1 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
