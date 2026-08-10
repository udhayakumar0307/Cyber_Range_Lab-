import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ShieldAlert } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker source locally from cdnjs to avoid asset hosting issues
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface MaterialItem {
  id: string;
  title: string;
  pdfUrl?: string;
}

export const PdfViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();
  
  const [material, setMaterial] = useState<MaterialItem | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Prevent screenshotting/print screen keys and standard copy key combinations
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' || 
        (e.ctrlKey && e.key === 'p') || 
        (e.metaKey && e.key === 'p') ||
        (e.ctrlKey && e.key === 's') ||
        (e.metaKey && e.key === 's')
      ) {
        e.preventDefault();
        alert('Action disabled to protect intellectual property.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const fetchMaterial = async () => {
      try {
        const res = await apiFetch(`/api/v1/study-materials`);
        if (!res.ok) throw new Error('Failed to load study materials catalog.');
        const list: MaterialItem[] = await res.json();
        const found = list.find((m) => String(m.id) === String(id));
        if (!found) {
          throw new Error('Study material not found.');
        }
        setMaterial(found);
        
        if (!found.pdfUrl) {
          throw new Error('No PDF version exists for this material.');
        }

        // Fetch PDF file contents as blob and load into pdf.js
        const pdfRes = await fetch(found.pdfUrl);
        if (!pdfRes.ok) throw new Error('Failed to retrieve PDF document file.');
        const pdfBlob = await pdfRes.blob();
        const pdfDataUrl = URL.createObjectURL(pdfBlob);

        const doc = await pdfjsLib.getDocument(pdfDataUrl).promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to render PDF.');
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [id]);

  useEffect(() => {
    if (!pdfDoc) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;

        // Apply dynamic overlay watermark (user name and email)
        const watermarkText = `${user?.name || 'Authorized Student'} (${user?.email || 'authenticated'})`;
        context.save();
        context.font = 'bold 16px Inter, sans-serif';
        context.fillStyle = 'rgba(100, 116, 139, 0.15)'; // Tailwind Slate-500 @ 15% opacity
        context.textAlign = 'center';
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate(-Math.PI / 4); // 45 degrees rotation

        // Tiled watermark arrangement across the canvas
        const stepX = 250;
        const stepY = 150;
        for (let x = -canvas.width; x < canvas.width; x += stepX) {
          for (let y = -canvas.height; y < canvas.height; y += stepY) {
            context.fillText(watermarkText, x, y);
          }
        }
        context.restore();
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, scale, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-400">Loading secure playbook viewer...</p>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Secure Viewer Error</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{error || 'Invalid study guide document request.'}</p>
        <button
          onClick={() => navigate('/study-material')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
        >
          Return to Study Materials
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen bg-slate-950 text-slate-150 flex flex-col select-none pdf-viewer-container"
    >
      {/* Top Header Control bar */}
      <header className="h-14 border-b border-slate-900 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 sticky top-0 z-50">
        <button
          onClick={() => navigate('/study-material')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Materials
        </button>
        <h1 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-md">
          {material.title}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.1))}
            className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-bold text-slate-450">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
            className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Document Canvas Render Space */}
      <div className="flex-1 flex justify-center items-start overflow-auto p-6 bg-slate-900/40">
        <div className="relative border border-slate-800 bg-white rounded-xl shadow-2xl overflow-hidden p-1">
          <canvas ref={canvasRef} className="max-w-full block" />
        </div>
      </div>

      {/* Floating Stepper Navigation Controls */}
      <footer className="h-14 border-t border-slate-900 bg-slate-950 px-6 flex items-center justify-center gap-6 sticky bottom-0 z-50">
        <button
          onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          disabled={pageNum <= 1}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-850 text-xs font-bold flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-xs font-bold text-slate-400">
          Page {pageNum} of {numPages}
        </span>
        <button
          onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
          disabled={pageNum >= numPages}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-850 text-xs font-bold flex items-center gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
export default PdfViewerPage;
