import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * DPDP Compliance Portal — student lab view.
 *
 * The lab is a self-contained web application (the DDS-CMS "Privacy Shield
 * Platform") that runs in its own container. This page frames that app.
 *
 * The app's URL is read from VITE_COMPLIANCE_PORTAL_URL at build time, e.g.
 *   VITE_COMPLIANCE_PORTAL_URL=https://compliance-portal.academy.deeptrustxai.com
 * or a same-origin reverse-proxy path such as
 *   VITE_COMPLIANCE_PORTAL_URL=/compliance-lab/
 *
 * When it is not configured we show a clear provisioning notice instead of
 * falling through to the generic terminal session (which belongs to other
 * labs), so the student never sees the wrong lab's content.
 */
export const CompliancePortalLabPage: React.FC = () => {
  const navigate = useNavigate();

  const labUrl = useMemo(() => {
    const raw = (import.meta.env.VITE_COMPLIANCE_PORTAL_URL || '').trim();
    return raw.replace(/\/+$/, '') || '';
  }, []);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        data === 'EXIT_SESSION' ||
        (data && typeof data === 'object' && (data.type === 'EXIT_SESSION' || data.action === 'EXIT_SESSION'))
      ) {
        navigate('/labs', { replace: true });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  return (
    <div className="w-full h-screen bg-[#0B1120] flex flex-col overflow-hidden">
      {/* Session bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0F172A] border-b border-slate-800 text-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/labs')}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            ← Back to Labs
          </button>
          <span className="text-sm font-bold tracking-tight flex items-center gap-2">
            <span>🛡️</span> DPDP Compliance Portal
          </span>
        </div>
        <span className="text-[11px] font-mono text-emerald-400">
          {labUrl ? (loaded ? 'ENVIRONMENT ONLINE' : 'CONNECTING…') : 'ENVIRONMENT NOT CONFIGURED'}
        </span>
      </div>

      {labUrl ? (
        <iframe
          src={labUrl}
          title="DPDP Compliance Portal"
          onLoad={() => setLoaded(true)}
          className="w-full flex-1 border-0"
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="clipboard-read; clipboard-write"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
            <div className="text-4xl mb-4">🛠️</div>
            <h2 className="text-lg font-bold text-white mb-2">Lab environment not configured</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              The DPDP Compliance Portal runs as its own container. An administrator
              needs to deploy it and set <code className="text-amber-300">VITE_COMPLIANCE_PORTAL_URL</code>{' '}
              before rebuilding the frontend. See{' '}
              <code className="text-amber-300">backup/labs/compliance-portal/INSTRUCTOR_GUIDE.md</code>.
            </p>
            <button
              onClick={() => navigate('/labs')}
              className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 transition"
            >
              Back to Labs
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompliancePortalLabPage;
