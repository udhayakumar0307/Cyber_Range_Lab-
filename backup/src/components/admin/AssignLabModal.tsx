import React, { useState, useEffect } from 'react';
import { X, Rocket, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface PurchasedLabOption {
  id: number;
  lab_id: string;
  lab_title: string;
  hours_remaining: number;
  status: string;
  is_free: boolean;
}

interface AssignLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
  memberCount: number;
  onAssigned: () => void;
}

export const AssignLabModal: React.FC<AssignLabModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  memberCount,
  onAssigned,
}) => {
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [labs, setLabs] = useState<PurchasedLabOption[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [startDatetime, setStartDatetime] = useState('');
  const [hoursPerStudent, setHoursPerStudent] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('pick');
    setSelectedLabId(null);
    setError(null);
    setSubmitting(false);
    // Default start time: 1 hour from now, formatted as local wall-clock time
    // for the datetime-local input (NOT toISOString/UTC — the backend treats
    // this value as a naive local (IST) timestamp, so it must match local time).
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setStartDatetime(localValue);

    const fetchLabs = async () => {
      setLoadingLabs(true);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/v1/admin/purchased-labs/available', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setLabs(data);
        }
      } catch (err) {
        console.error('Error fetching purchased labs:', err);
      } finally {
        setLoadingLabs(false);
      }
    };
    fetchLabs();
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedLab = labs.find((l) => l.id === selectedLabId) || null;
  const totalHours = memberCount * hoursPerStudent;

  const handleContinue = () => {
    if (!selectedLabId) {
      setError('Select a lab to continue.');
      return;
    }
    if (!startDatetime) {
      setError('Choose a start date/time.');
      return;
    }
    if (selectedLab && totalHours > selectedLab.hours_remaining) {
      setError(
        `Not enough hours remaining: need ${totalHours.toFixed(1)}h for ${memberCount} students, only ${selectedLab.hours_remaining.toFixed(1)}h left.`
      );
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selectedLabId) return;
    setSubmitting(true);
    setError(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/admin/groups/${groupId}/assign-lab`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          purchased_lab_id: selectedLabId,
          // startDatetime is a <input type="datetime-local"> value (local wall clock,
          // no offset). new Date(...) parses it as local time; toISOString() then
          // gives the true UTC instant with an explicit "Z" offset, which is what
          // the backend's parse_client_datetime requires.
          start_datetime: new Date(startDatetime).toISOString(),
          hours_per_student: hoursPerStudent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || 'Failed to assign lab.');
        setSubmitting(false);
        return;
      }
      onAssigned();
      onClose();
    } catch (err) {
      console.error('Error assigning lab:', err);
      setError('An error occurred while assigning the lab.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-[#0052CC] dark:text-blue-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {step === 'pick' ? 'Assign Lab' : 'Confirm Assignment'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{groupName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'pick' ? (
          <div className="p-6 space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Lab</label>
              {loadingLabs ? (
                <p className="text-slate-400">Loading purchased labs...</p>
              ) : labs.length === 0 ? (
                <p className="text-rose-500">No purchased labs with remaining hours found. Purchase a lab from the Marketplace first.</p>
              ) : (
                <select
                  value={selectedLabId ?? ''}
                  onChange={(e) => setSelectedLabId(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Select a lab...</option>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lab_title} — {l.is_free ? 'Free' : `${l.hours_remaining.toFixed(1)}h remaining`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={startDatetime}
                  onChange={(e) => setStartDatetime(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Hours / Student</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={hoursPerStudent}
                  onChange={(e) => setHoursPerStudent(Math.max(0.5, Number(e.target.value)))}
                  className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
              {memberCount} students × {hoursPerStudent}h = <strong>{totalHours.toFixed(1)}h</strong> will be deducted from the selected purchase's balance.
            </p>

            {error && <p className="text-rose-500 font-semibold">{error}</p>}
          </div>
        ) : (
          <div className="p-6 space-y-3 text-xs">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 space-y-2 text-slate-700 dark:text-slate-300">
              <p><strong>{selectedLab?.lab_title}</strong> will be assigned to <strong>{groupName}</strong>.</p>
              <p>Starts: <strong>{new Date(startDatetime).toLocaleString()}</strong></p>
              <p>
                Total <strong>{memberCount}</strong> student(s) × {hoursPerStudent}h ={' '}
                <strong>{totalHours.toFixed(1)} hours</strong> will be deducted from your purchased balance
                ({selectedLab ? (selectedLab.hours_remaining - totalHours).toFixed(1) : '-'}h will remain).
              </p>
              <p>All verified students in this group will receive an in-app notification.</p>
            </div>
            {error && <p className="text-rose-500 font-semibold">{error}</p>}
          </div>
        )}

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-800/40">
          {step === 'pick' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={labs.length === 0}
                className="px-5 py-2 rounded-xl bg-[#0052CC] hover:bg-blue-600 disabled:opacity-50 text-white font-bold transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('pick')}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-[#28A745] hover:bg-emerald-600 disabled:opacity-50 text-white font-bold transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> {submitting ? 'Assigning...' : 'Confirm & Assign'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
