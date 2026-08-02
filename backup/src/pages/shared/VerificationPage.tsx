import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, Download, Share2, Award, Clock, CheckCircle2, ArrowLeft, AlertCircle } from 'lucide-react';
import { CertificateTemplate, CertificatePreviewWrapper } from '../../components/user/CertificateTemplate';

interface VerificationData {
  status: string;
  display_certificate_id: string;
  recipient_name: string;
  lab_title: string;
  category: string;
  completion_date: string;
  duration: string;
  score: number;
  percentage: number;
  badge_earned: string;
  issued_by: string;
  pdf_url?: string;
  png_url?: string;
}

export const VerificationPage: React.FC = () => {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVerification = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/reporting/certificates/verify/${certificateId}`);
        if (!res.ok) {
          throw new Error('Certificate not found or invalid.');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to verify certificate.');
      } finally {
        setLoading(false);
      }
    };
    if (certificateId) {
      fetchVerification();
    }
  }, [certificateId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-6 py-8 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">CyberRange Official Portal</span>
              <h1 className="text-xl sm:text-2xl font-black text-white">Certificate Verification</h1>
            </div>
          </div>
          <Link
            to="/login"
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Platform
          </Link>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="font-semibold text-sm">Verifying certificate credentials...</p>
            </div>
          ) : error || !data ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-white mb-1">Verification Failed</h2>
              <p className="text-slate-400 text-sm">{error || 'Invalid Certificate ID'}</p>
            </div>
          ) : (
            <div>
              {/* Authenticity Badge */}
              <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">VALID CERTIFICATE</h3>
                  <p className="text-xs text-emerald-400/80">Issued by {data.issued_by}</p>
                </div>
              </div>

              {/* Grid details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-sm">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Certificate ID</span>
                  <span className="font-mono font-bold text-blue-400">{data.display_certificate_id}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Issued To</span>
                  <span className="font-bold text-white text-base">{data.recipient_name}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 md:col-span-2">
                  <span className="text-xs text-slate-400 block mb-1">Laboratory Title</span>
                  <span className="font-bold text-white text-base">{data.lab_title}</span>
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                    {data.category}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Completion Date</span>
                  <span className="font-semibold text-slate-200">{data.completion_date}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Accuracy / Score</span>
                  <span className="font-semibold text-emerald-400">{data.score} Pts ({data.percentage}%)</span>
                </div>
              </div>

              {/* Certificate Preview */}
              <div className="mb-8 overflow-hidden">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Official Certificate Document</h3>
                <CertificatePreviewWrapper
                  recipientName={data.recipient_name}
                  labTitle={data.lab_title}
                  category={data.category}
                  score={data.score}
                  percentage={data.percentage}
                  points={data.score}
                  completedAt={data.completion_date}
                  duration={data.duration}
                  certificateId={data.display_certificate_id}
                  badgeTitle={`${data.lab_title.slice(0, 18)} Master`}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  {data.pdf_url && (
                    <a
                      href={data.pdf_url}
                      download
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </a>
                  )}
                  {data.png_url && (
                    <a
                      href={data.png_url}
                      download
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-slate-700"
                    >
                      <Download className="w-4 h-4 text-blue-400" /> Download PNG
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      alert('Verification link copied to clipboard!');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3.5 py-2.5 rounded-lg transition-colors inline-flex items-center gap-1.5 border border-slate-700"
                  >
                    <Share2 className="w-4 h-4 text-blue-400" /> Copy Link
                  </button>

                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#0A66C2] hover:bg-[#004182] text-white font-bold text-xs px-3.5 py-2.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    Share on LinkedIn
                  </a>

                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I completed ${data.lab_title} on CyberRange! View my official certificate:`)}&url=${encodeURIComponent(window.location.href)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-black hover:bg-slate-900 text-white border border-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  >
                    Share on X
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationPage;
