import React from 'react';
import { Calendar, ShieldCheck, Contact2 } from 'lucide-react';

export interface CertificateData {
  recipientName: string;
  labTitle: string;
  category?: string;
  score?: number;
  percentage?: number;
  points?: number;
  completedAt: string;
  duration?: string;
  certificateId: string;
  badgeTitle?: string;
  verifyUrl?: string;
  pngUrl?: string;
}

const FontLoader: React.FC = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Great+Vibes&family=Cinzel:wght@600;700;800;900&display=swap');
    .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-cinzel { font-family: 'Cinzel', serif; }
    .font-signature { font-family: 'Great Vibes', cursive; }
  `}</style>
);

export const CertificateTemplate: React.FC<CertificateData> = (props) => {
  const { recipientName, labTitle, completedAt, certificateId } = props;

  const displayRecipient = (recipientName || 'CyberRange Student').toUpperCase();
  const displayLab = (labTitle || 'First Security Lab Environment').toUpperCase();
  const displayDate = (completedAt || '31 JULY 2026').toUpperCase();
  const displayId = (certificateId || 'CYR-2026-000001').toUpperCase();

  return (
    <>
      <FontLoader />
      <div
        id="certificate-template-wrapper"
        className="relative bg-[#FAFBFD] rounded-xl shadow-2xl overflow-hidden select-none text-[#0B1F3A] shrink-0 font-jakarta border border-slate-200"
        style={{
          width: '1400px',
          height: '990px',
          aspectRatio: '1400 / 990',
          boxSizing: 'border-box',
        }}
      >
        {/* Background Circuit Vectors */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
          {/* Top Right Circuit */}
          <path d="M 950 0 L 1100 0 L 1150 50 L 1300 50 L 1350 100 L 1400 100" stroke="#0B1F3A" strokeWidth="1.5" fill="none" />
          <path d="M 1000 0 L 1050 50 L 1250 50 L 1300 100" stroke="#C5A059" strokeWidth="1.5" fill="none" />
          <circle cx="1150" cy="50" r="4" fill="#0B1F3A" />
          <circle cx="1300" cy="50" r="4" fill="#C5A059" />

          {/* Left Circuit */}
          <path d="M 0 500 L 50 500 L 100 550 L 100 700 L 150 750" stroke="#0B1F3A" strokeWidth="1.5" fill="none" />
          <circle cx="100" cy="550" r="4" fill="#C5A059" />
          <circle cx="150" cy="750" r="4" fill="#0B1F3A" />
        </svg>

        {/* Top-Right Decorative Corner Ribbons */}
        <div className="absolute top-0 right-0 w-[420px] h-[160px] pointer-events-none overflow-hidden">
          <div className="absolute top-[-90px] right-[-60px] w-[500px] h-[160px] bg-[#0B1F3A] transform rotate-[25deg] shadow-lg" />
          <div className="absolute top-[-40px] right-[-60px] w-[500px] h-[16px] bg-[#C5A059] transform rotate-[25deg]" />
          <div className="absolute top-[-15px] right-[-60px] w-[500px] h-[8px] bg-[#E2B755] transform rotate-[25deg]" />
        </div>

        {/* Bottom-Left Decorative Corner Ribbons */}
        <div className="absolute bottom-0 left-0 w-[420px] h-[180px] pointer-events-none overflow-hidden">
          <div className="absolute bottom-[-100px] left-[-60px] w-[500px] h-[180px] bg-[#0B1F3A] transform rotate-[25deg] shadow-lg" />
          <div className="absolute bottom-[40px] left-[-60px] w-[500px] h-[16px] bg-[#C5A059] transform rotate-[25deg]" />
          <div className="absolute bottom-[68px] left-[-60px] w-[500px] h-[8px] bg-[#E2B755] transform rotate-[25deg]" />
        </div>

        {/* Bottom-Right Dot Matrix */}
        <div className="absolute bottom-12 right-12 grid grid-cols-12 gap-1.5 opacity-25 pointer-events-none">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#0B1F3A]" />
          ))}
        </div>

        {/* Main Certificate Outer Frame Border */}
        <div className="absolute inset-8 border border-slate-200/80 rounded-lg pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 h-full flex flex-col justify-between p-14 sm:p-16">
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo Shield */}
              <div className="w-14 h-14 rounded-2xl bg-[#0B1F3A] border-2 border-[#C5A059] flex items-center justify-center text-amber-400 shadow-md">
                <div className="relative flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-[#C5A059]" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-[0.15em] text-[#0B1F3A] font-cinzel">CYBER RANGE</h2>
                <p className="text-[9px] font-black tracking-[0.25em] text-[#C5A059] uppercase mt-0.5">LEARN. PRACTICE. DEFEND.</p>
              </div>
            </div>
          </div>

          {/* Certificate Header Title */}
          <div className="text-center mt-2">
            <h1 className="text-5xl font-black tracking-[0.25em] text-[#0B1F3A] uppercase font-cinzel">
              CERTIFICATE
            </h1>

            {/* Gold Divider Line with Circle Markers */}
            <div className="flex items-center justify-center gap-3 my-3 max-w-lg mx-auto">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#C5A059] to-[#C5A059]" />
              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#C5A059] bg-white" />
              <span className="text-xs font-bold text-[#C5A059] tracking-[0.35em] uppercase font-jakarta px-2">
                OF COMPLETION
              </span>
              <div className="w-2.5 h-2.5 rounded-full border-2 border-[#C5A059] bg-white" />
              <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[#C5A059] to-[#C5A059]" />
            </div>
          </div>

          {/* Recipient Statement Body */}
          <div className="text-center space-y-3 max-w-4xl mx-auto">
            <p className="text-xs font-bold tracking-[0.25em] text-slate-500 uppercase">
              THIS IS TO CERTIFY THAT
            </p>

            {/* Recipient Name (Dynamic DB) */}
            <div className="py-2">
              <h2 className="text-4xl sm:text-5xl font-black text-[#0B1F3A] tracking-wider font-cinzel px-8 inline-block">
                {displayRecipient}
              </h2>
              {/* Golden Underline Accent with Center Diamond */}
              <div className="flex items-center justify-center gap-2 max-w-md mx-auto mt-2">
                <div className="h-[2px] flex-1 bg-[#C5A059]" />
                <div className="w-2 h-2 rotate-45 bg-[#C5A059]" />
                <div className="h-[2px] flex-1 bg-[#C5A059]" />
              </div>
            </div>

            <p className="text-xs font-bold tracking-[0.25em] text-slate-500 uppercase pt-2">
              HAS SUCCESSFULLY COMPLETED THE LAB
            </p>

            {/* Lab Title (Dynamic DB) */}
            <h3 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight leading-snug uppercase max-w-3xl mx-auto py-1">
              {displayLab}
            </h3>
            <div className="w-16 h-[2px] bg-[#C5A059] mx-auto rounded-full" />
          </div>

          {/* Footer Details Grid (Date & ID Card Badges) */}
          <div className="flex items-center justify-center gap-16 my-2">
            {/* Completed Date Card */}
            <div className="flex items-center gap-4 bg-white border border-slate-200/80 px-6 py-3 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-full border-2 border-[#C5A059] flex items-center justify-center text-[#C5A059]">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black text-slate-400 tracking-widest block uppercase">COMPLETED ON</span>
                <span className="text-sm font-extrabold text-[#0B1F3A] tracking-wide">{displayDate}</span>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-12 w-[1px] bg-slate-200" />

            {/* Certificate ID Card */}
            <div className="flex items-center gap-4 bg-white border border-slate-200/80 px-6 py-3 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-full border-2 border-[#C5A059] flex items-center justify-center text-[#C5A059]">
                <Contact2 className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black text-slate-400 tracking-widest block uppercase">CERTIFICATE ID</span>
                <span className="text-sm font-extrabold text-[#0B1F3A] tracking-wide font-mono">{displayId}</span>
              </div>
            </div>
          </div>

          {/* Signatures and Verification Seal */}
          <div className="flex items-end justify-between px-6 pt-4 border-t border-slate-200/60">
            {/* Left/Center Signature */}
            <div className="text-left">
              <span className="font-signature text-3xl text-[#0B1F3A] block leading-none pl-2">CyberRange</span>
              <div className="w-48 h-[1.5px] bg-[#C5A059] my-1" />
              <span className="text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase block">
                CYBER RANGE LEARNING PLATFORM
              </span>
            </div>

            {/* Right Verified Author Badge */}
            <div className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 rounded-full bg-[#0B1F3A] text-[#C5A059] border border-[#C5A059] flex items-center justify-center shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-xs font-black tracking-widest text-[#0B1F3A] block uppercase">VERIFIED</span>
                <span className="text-[10px] font-bold text-slate-400 block">Verified by Author</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const CertificatePreviewWrapper: React.FC<CertificateData> = (props) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.6);

  React.useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const targetScale = Math.min(1, Math.max(0.2, containerWidth / 1400));
        setScale(targetScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  if (props.pngUrl) {
    return (
      <div className="w-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
        <img src={props.pngUrl} alt={`Certificate - ${props.labTitle}`} className="w-full h-auto object-contain max-w-[1400px]" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full flex items-center justify-center overflow-hidden">
      <div
        style={{
          width: '1400px',
          height: '990px',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: `-${990 * (1 - scale)}px`,
        }}
      >
        <CertificateTemplate {...props} />
      </div>
    </div>
  );
};

export default CertificateTemplate;
