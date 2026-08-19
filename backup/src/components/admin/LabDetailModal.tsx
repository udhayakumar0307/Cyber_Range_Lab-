import React from 'react';
import type { SecurityLab } from '../../types/admin';
import {
  X,
  ShieldCheck,
  Layers,
  CheckCircle,
  Download,
  Share2
} from 'lucide-react';

interface LabDetailModalProps {
  lab: SecurityLab | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LabDetailModal: React.FC<LabDetailModalProps> = ({ lab, isOpen, onClose }) => {
  if (!isOpen || !lab) return null;

  const difficultyColors = {
    Beginner: 'bg-emerald-50 text-[#28A745] border-emerald-200',
    Intermediate: 'bg-blue-50 text-[#0052CC] border-blue-200',
    Advanced: 'bg-amber-50 text-amber-700 border-amber-200',
    Expert: 'bg-purple-50 text-[#6F42C1] border-purple-200',
  };

  const handleShareCertificate = async () => {
    const verifyUrl = lab.certificateId
      ? `${window.location.origin}/certificate/verify/${lab.certificateId}`
      : window.location.href;
    const shareData = {
      title: `CyberRange Certificate — ${lab.title}`,
      text: `I completed ${lab.title} on CyberRange!`,
      url: verifyUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(verifyUrl);
      alert('Certificate verification link copied to clipboard.');
    } catch {
      alert(verifyUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-start justify-between relative">
          <div className="pr-8">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
                {lab.category}
              </span>
              <span className={`text-xs font-bold border px-2.5 py-0.5 rounded-full ${difficultyColors[lab.difficulty ?? 'Beginner'] ?? ''}`}>
                {lab.difficulty}
              </span>
              {lab.isPurchased && (
                <span className="text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> In Inventory
                </span>
              )}
              {lab.isCompleted && (
                <span className="text-xs font-bold bg-amber-500/30 text-amber-200 border border-amber-400/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Completed
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">
              {lab.title}
            </h2>

            <div className="flex items-center gap-4 text-xs text-slate-300 mt-2">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                {(lab.modules ?? []).length} Security Modules
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scroll Body */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Detailed Overview */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Lab Overview
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed font-normal">
              {lab.fullDescription}
            </p>
          </div>

          {/* Key Skills Covered */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Skills Tested & Trained
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(lab.skillsCovered ?? []).map((skill, idx) => (
                <span
                  key={idx}
                  className="bg-blue-50 text-[#0052CC] border border-blue-100 px-2.5 py-1 rounded-md text-xs font-semibold"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Included Challenge Modules */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Challenge Modules ({(lab.modules ?? []).length})
            </h3>
            <div className="space-y-2">
              {(lab.modules ?? []).map((mod, idx) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800">{mod.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500 font-medium">
                    <span>{mod.durationMinutes} mins</span>
                    <span className="text-[#0052CC] font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                      +{mod.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          {(lab.prerequisites ?? []).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Prerequisites & Target Knowledge
              </h3>
              <ul className="space-y-1 text-xs text-slate-600">
                {(lab.prerequisites ?? []).map((req, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#28A745]" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            {lab.isCompleted && lab.certificatePdfUrl ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <a
                  href={lab.certificatePdfUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Certificate
                </a>
                <button
                  type="button"
                  onClick={handleShareCertificate}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Share Certificate
                </button>
              </div>
            ) : lab.isCompleted ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-bold">
                <CheckCircle className="w-3.5 h-3.5" /> Completed — certificate generating, check back shortly
              </span>
            ) : lab.isPurchased ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Lab Purchased
              </span>
            ) : (
              <>
                <span className="text-xs text-slate-500 font-semibold block">Price / Hour</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">&#8377;{(lab.priceInr ?? 0).toLocaleString('en-IN')}</span>
                  <span className="text-xs text-slate-500">/ hr &mdash; close this and click Add to Cart</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
