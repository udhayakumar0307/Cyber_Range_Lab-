import React, { useEffect, useState } from 'react';
import { X, HelpCircle, Info, Calculator, FileText } from 'lucide-react';
import type { CtfChallenge, CtfChallengeFile } from '../../types/ctf';
import { HintManager } from './HintManager';
import type { LocalHint } from './HintManager';
import { FileUploadWidget } from './FileUploadWidget';

interface ChallengeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctfId: number;
  challenge?: CtfChallenge | null;
  onSave: () => void;
}

export const ChallengeFormModal: React.FC<ChallengeFormModalProps> = ({
  isOpen,
  onClose,
  ctfId,
  challenge,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Web');
  const [description, setDescription] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [challengeUrl, setChallengeUrl] = useState('');
  const [flag, setFlag] = useState('');
  const [scoringMode, setScoringMode] = useState<'static' | 'dynamic'>('static');
  
  // Static points
  const [staticPoints, setStaticPoints] = useState<number>(500);

  // Dynamic points
  const [dynamicCeiling, setDynamicCeiling] = useState<number>(500);
  const [dynamicFloor, setDynamicFloor] = useState<number>(50);
  const [decayConstant, setDecayConstant] = useState<number>(100);

  // Hints and Files
  const [hints, setHints] = useState<LocalHint[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<CtfChallengeFile[]>([]);
  const [removedFileIds, setRemovedFileIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (challenge) {
      setTitle(challenge.title);
      setCategory(challenge.category || 'Web');
      setDescription(challenge.description || '');
      setConnectionString(challenge.connection_string || '');
      setChallengeUrl(challenge.challenge_url || '');
      setFlag('');
      setScoringMode(challenge.scoring_mode ?? 'static');
      
      if ((challenge.scoring_mode ?? 'static') === 'static') {
        setStaticPoints(challenge.static_points || 500);
      } else {
        setDynamicCeiling(challenge.dynamic_ceiling || 500);
        setDynamicFloor(challenge.dynamic_floor || 50);
        setDecayConstant(challenge.decay_constant || 100);
      }

      setHints(
        challenge.hints.map((h) => ({
          order_index: h.order_index ?? 0,
          text: h.text || '',
          cost_percent: h.cost_percent ?? 0,
        }))
      );
      setExistingFiles(challenge.files || []);
    } else {
      // Clear fields
      setTitle('');
      setCategory('Web');
      setDescription('');
      setConnectionString('');
      setChallengeUrl('');
      setFlag('');
      setScoringMode('static');
      setStaticPoints(500);
      setDynamicCeiling(500);
      setDynamicFloor(50);
      setDecayConstant(100);
      setHints([]);
      setExistingFiles([]);
    }
    setNewFiles([]);
    setRemovedFileIds([]);
    setError(null);
  }, [challenge, isOpen]);

  if (!isOpen) return null;

  // Calculate dynamic decay preview
  const getDecayPreview = () => {
    const preview = [];
    const ceiling = Number(dynamicCeiling) || 0;
    const floor = Number(dynamicFloor) || 0;
    const k = Number(decayConstant) || 0;
    
    for (const n of [1, 2, 3, 5, 10, 20]) {
      const val = Math.max(floor, Math.ceil(ceiling - k * Math.log(n)));
      preview.push({ solves: n, points: val });
    }
    return preview;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('connection_string', connectionString);
      formData.append('challenge_url', challengeUrl);
      
      // Only append flag if provided or if creating new challenge
      if (flag || !challenge) {
        formData.append('flag', flag);
      } else {
        // If editing and no new flag provided, we still need to pass a value, 
        // backend should ignore or keep old hashed flag. For safety, pass empty if same.
        // Wait, backend endpoints allow flag to be optional on update. So we omit if empty.
      }

      formData.append('scoring_mode', scoringMode);
      if (scoringMode === 'static') {
        formData.append('static_points', String(staticPoints));
      } else {
        formData.append('dynamic_ceiling', String(dynamicCeiling));
        formData.append('dynamic_floor', String(dynamicFloor));
        formData.append('decay_constant', String(decayConstant));
      }

      // Hints list
      formData.append('hints_json', JSON.stringify(hints));

      // Append new files
      newFiles.forEach((file) => {
        formData.append('files', file);
      });

      // Handle removed existing files
      if (challenge && removedFileIds.length > 0) {
        // Wait, backend edit endpoint can take deleted fileIds or simply replace them.
        // Let's pass the removed file IDs as a field.
        formData.append('removed_file_ids', JSON.stringify(removedFileIds));
      }

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const url = challenge
        ? `/api/v1/ctf/${ctfId}/challenge/${challenge.id}`
        : `/api/v1/ctf/${ctfId}/challenge`;
      
      const method = challenge ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save challenge.');
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveExistingFile = (fileId: number) => {
    setExistingFiles(existingFiles.filter((f) => f.id !== fileId));
    setRemovedFileIds([...removedFileIds, fileId]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-bottom border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {challenge ? 'Edit Challenge' : 'Create New Challenge'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Configure flags, files, scoring mode, and hints</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm p-3.5 rounded-xl flex items-start gap-2.5">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Challenge Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. SQLi Authentication Bypass"
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
              >
                <option value="Web">Web Exploitation</option>
                <option value="Pwn">Binary Exploitation / Pwn</option>
                <option value="Reverse">Reverse Engineering</option>
                <option value="Crypto">Cryptography</option>
                <option value="Forensics">Digital Forensics</option>
                <option value="OSINT">OSINT</option>
                <option value="Misc">Miscellaneous</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Description (Markdown Supported)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a clear briefing of the challenge objectives and targets..."
              rows={4}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
              required
            />
          </div>

          {/* Connection targets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Connection String (Optional)</label>
              <input
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="e.g. nc host.target.local 1337"
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">GCP Challenge URL (Optional)</label>
              <input
                type="url"
                value={challengeUrl}
                onChange={(e) => setChallengeUrl(e.target.value)}
                placeholder="e.g. https://ctf-challenge-x-backend.target.in"
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
              />
            </div>
          </div>

          {/* Flag and Scoring Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 pt-6">
            
            {/* Flag field */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Flag Pattern</label>
                  <span className="text-[10px] text-slate-400">(case-sensitive, exact match)</span>
                </div>
                <input
                  type="text"
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  placeholder={challenge ? "•••••••••••• (Leave blank to keep current)" : "e.g. CTF{your_flag_here}"}
                  className="w-full text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                  required={!challenge}
                />
              </div>

              {/* File Upload Widget */}
              <FileUploadWidget
                files={newFiles}
                onChange={setNewFiles}
                existingFiles={existingFiles}
                onRemoveExisting={handleRemoveExistingFile}
              />
            </div>

            {/* Scoring Options */}
            <div className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">Scoring Model</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      checked={scoringMode === 'static'}
                      onChange={() => setScoringMode('static')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Static
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      checked={scoringMode === 'dynamic'}
                      onChange={() => setScoringMode('dynamic')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    Dynamic
                  </label>
                </div>
              </div>

              {scoringMode === 'static' ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Static Points Payout</label>
                    <input
                      type="number"
                      min="1"
                      value={staticPoints}
                      onChange={(e) => setStaticPoints(Number(e.target.value) || 0)}
                      className="w-full text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-3.5 py-2.5 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal block">
                    Points remain fixed throughout the competition, regardless of how many solves are recorded.
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 block truncate">Max (Ceiling)</label>
                      <input
                        type="number"
                        min="1"
                        value={dynamicCeiling}
                        onChange={(e) => setDynamicCeiling(Number(e.target.value) || 0)}
                        className="w-full text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-2.5 py-2 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 block truncate">Min (Floor)</label>
                      <input
                        type="number"
                        min="1"
                        value={dynamicFloor}
                        onChange={(e) => setDynamicFloor(Number(e.target.value) || 0)}
                        className="w-full text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-2.5 py-2 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 block truncate">Decay Constant (k)</label>
                      <input
                        type="number"
                        min="1"
                        value={decayConstant}
                        onChange={(e) => setDecayConstant(Number(e.target.value) || 0)}
                        className="w-full text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 px-2.5 py-2 text-slate-800 dark:text-slate-100 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Decay simulation */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                      <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Decay Point Projection</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-[10px]">
                      {getDecayPreview().map((item) => (
                        <div key={item.solves} className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1 last:border-b-0">
                          <span className="text-slate-400 font-medium font-mono">{item.solves} solve{item.solves > 1 ? 's' : ''}:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{item.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hint Manager Widget */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
            <HintManager hints={hints} onChange={setHints} />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl transition-colors shadow-lg shadow-indigo-500/25"
          >
            {loading ? 'Saving...' : 'Save Challenge'}
          </button>
        </div>

      </div>
    </div>
  );
};
