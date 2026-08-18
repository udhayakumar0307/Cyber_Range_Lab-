import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ArrowLeft, ChevronDown, MessageSquareWarning } from 'lucide-react';

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: 'How do I start a lab or terminal session?',
    answer: 'Open the lab from Available Labs and click "Start Lab" / "Start Terminal". The environment provisions on demand — it is not started automatically when you open the page.',
  },
  {
    question: 'Why is my lab timer counting down / paused?',
    answer: 'Paid labs bill in whole hours while the session is actively in use. Free labs never show a timer. Time only decrements while you are using the lab, and resumes correctly if you leave and come back.',
  },
  {
    question: 'My certificate looks outdated after a design update.',
    answer: 'Certificates are cached once generated. If you believe yours is stale, reopen it from Available Labs — it regenerates automatically if the file is missing.',
  },
  {
    question: 'I found a bug or have feedback about a lab, puzzle, or CTF challenge.',
    answer: 'Use the Feedback tab in Settings to report it — pick the relevant category so it reaches the right place.',
  },
  {
    question: 'Who do I contact for account or billing issues?',
    answer: 'Submit it through the Feedback tab in Settings, or email the platform administrator directly.',
  },
];

export const HelpFAQPage: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#2D3436] py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#0052CC] flex items-center justify-center shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Documentation &amp; Help</h1>
              <p className="text-sm text-slate-500 mt-1">Answers to common questions about CyberRange labs, billing, and certificates.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div key={idx}>
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 py-4 text-left"
                  >
                    <span className="text-sm font-bold text-slate-800">{item.question}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="text-sm text-slate-600 leading-relaxed pb-4 pr-6">{item.answer}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <MessageSquareWarning className="w-5 h-5 text-[#FFA500] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-800 block mb-0.5">Still stuck?</span>
              Go to Settings → Feedback to report an issue with a lab, puzzle, or CTF challenge.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
