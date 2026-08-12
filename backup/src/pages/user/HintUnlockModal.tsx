import React, { useState } from 'react';
import { HelpCircle, AlertTriangle, X } from 'lucide-react';
import type { CtfHint } from '../../types/ctf';

interface HintUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctfId: number;
  challengeId: number;
  hint: CtfHint;
  onUnlockSuccess: (hintId: number, hintText: string) => void;
}

export const HintUnlockModal: React.FC<HintUnlockModalProps> = ({
  isOpen,
  onClose,
  ctfId,
  challengeId,
  hint,
  onUnlockSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(
        `/api/v1/ctf/${ctfId}/challenge/${challengeId}/hint/${hint.id}/unlock`,
        {
          method: 'POST',
          headers,
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to unlock hint.');
      }

      onUnlockSuccess(Number(hint.id), data.text);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error unlocking hint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-2">
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-full text-amber-500">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Unlock Challenge Hint?</h3>
            <p className="text-xs text-slate-400 leading-normal max-w-sm">
              Unlocking this hint will permanently reduce your potential payout for this challenge by{' '}
              <span className="font-extrabold text-rose-500">{hint.cost_percent ?? 0}%</span>. This action is irreversible.
            </p>
          </div>

          {error && (
            <div className="w-full text-rose-500 text-xs bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              {error}
            </div>
          )}

          <div className="flex gap-3 w-full border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUnlock}
              disabled={loading}
              className="flex-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-xl transition-colors shadow-md shadow-amber-500/20"
            >
              {loading ? 'Unlocking...' : 'Confirm Unlock'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
