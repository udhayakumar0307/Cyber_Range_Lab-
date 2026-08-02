import React from 'react';

export interface CertificateData {
  recipientName: string;
  labTitle: string;
  category?: string;
  score: number;
  percentage?: number;
  points?: number;
  completedAt: string;
  duration: string;
  certificateId: string;
  badgeTitle?: string;
  verifyUrl?: string;
  pngUrl?: string;
}

const FontLoader: React.FC = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    .font-jakarta {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .clip-diagonal { clip-path: polygon(100% 0, 100% 100%, 0 0); }
    .clip-diagonal-bottom { clip-path: polygon(0 0, 100% 100%, 0 100%); }
  `}</style>
);

export const CertificateTemplate: React.FC<CertificateData> = (props) => {
  const { recipientName, labTitle, completedAt, certificateId, pngUrl } = props;

  if (pngUrl) {
    return (
      <div id="certificate-template-wrapper" className="w-full flex items-center justify-center select-none overflow-hidden rounded-xl shadow-2xl border border-slate-200 bg-white">
        <img
          src={pngUrl}
          alt={`Certificate - ${labTitle}`}
          className="w-full h-auto object-contain max-w-[1400px]"
        />
      </div>
    );
  }

  return (
    <>
      <FontLoader />
      <div
        id="certificate-template-wrapper"
        className="relative bg-white rounded-xl shadow-2xl overflow-hidden select-none text-slate-900 border border-slate-200 shrink-0 font-jakarta"
        style={{
          width: '1400px',
          height: '990px',
          aspectRatio: '1400 / 990',
          boxSizing: 'border-box',
        }}
      >
        {/* Rendered Master BG Preview fallback */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-[300px] h-[150px] bg-[#0B1F3A] clip-diagonal transform rotate-12 origin-top-right opacity-90" />
          <div className="absolute bottom-0 left-0 w-[250px] h-[180px] bg-[#0B1F3A] clip-diagonal-bottom transform rotate-12 origin-bottom-left opacity-90" />
        </div>

        {/* Certificate Text & Layout Overlay */}
        <div className="relative z-10 h-full flex flex-col justify-between p-16">
          {/* Header row */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center font-bold">CR</div>
              <div>
                <h2 className="text-xl font-extrabold tracking-wider text-[#0B1F3A]">CYBER RANGE</h2>
                <p className="text-[8px] font-bold tracking-[0.2em] text-slate-400">LEARN. PRACTICE. DEFEND.</p>
              </div>
            </div>
          </div>

          {/* Certificate Title */}
          <div className="text-center my-4">
            <h1 className="text-5xl font-black text-[#0B1F3A] tracking-[0.25em] uppercase">CERTIFICATE</h1>
            <p className="text-sm font-bold text-[#D89B2B] tracking-[0.3em] uppercase mt-2">OF COMPLETION</p>
          </div>

          {/* Certification Body */}
          <div className="text-center space-y-4">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">THIS IS TO CERTIFY THAT</p>
            <h2 className="text-5xl font-black text-[#0B1F3A] py-1 border-b-2 border-slate-100 max-w-xl mx-auto tracking-wide">{recipientName}</h2>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold pt-3">HAS SUCCESSFULLY COMPLETED THE LAB</p>
            <h3 className="text-3xl font-extrabold text-[#0B1F3A] tracking-tight max-w-2xl mx-auto leading-relaxed">{labTitle}</h3>
          </div>

          {/* Info Details Footer Row */}
          <div className="flex items-center justify-center gap-24 border-t border-slate-100 pt-8 pb-4">
            <div className="text-center">
              <span className="text-[10px] font-black text-slate-400 tracking-wider block uppercase">COMPLETED ON</span>
              <span className="text-sm font-extrabold text-[#0B1F3A]">{completedAt}</span>
            </div>
            <div className="h-10 w-[1px] bg-slate-200" />
            <div className="text-center">
              <span className="text-[10px] font-black text-slate-400 tracking-wider block uppercase">CERTIFICATE ID</span>
              <span className="text-sm font-extrabold text-[#0B1F3A]">{certificateId}</span>
            </div>
          </div>

          {/* Signatures and Seals */}
          <div className="flex items-end justify-between px-10">
            <div className="text-left">
              <span className="font-semibold text-lg text-[#0B1F3A] block border-b border-slate-300 pb-1">CyberRange</span>
              <span className="text-[10px] text-slate-500 block pt-1">CYBER RANGE LEARNING PLATFORM</span>
            </div>
            <div className="text-right">
              <span className="font-extrabold text-xs text-[#0B1F3A] uppercase tracking-widest block">VERIFIED</span>
              <span className="text-[9px] text-slate-400 block">Verified by Author</span>
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
