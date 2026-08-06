import React, { useState } from 'react';
import type { CsvImportUserRow, PlatformUser } from '../../types/admin';
import { X, FileSpreadsheet, UploadCloud, Download, CheckCircle2, AlertCircle, Users, ArrowRight } from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportUsers: (newUsers: PlatformUser[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportUsers,
}) => {
  if (!isOpen) return null;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/users/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to import users file');
      }

      setImportSummary(data);
      onImportUsers([]); // Refresh parent list
    } catch (err: any) {
      setUploadError(err.message || 'An error occurred during file upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-[#6F42C1] dark:text-purple-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Bulk Import Users via CSV
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Batch provision multiple user accounts simultaneously</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {!importSummary ? (
            /* Upload Drop Area */
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-[#0052CC] bg-slate-50/50 hover:bg-blue-50/40 rounded-2xl p-8 text-center block cursor-pointer transition-all group">
                <input 
                  type="file" 
                  accept=".csv, .xlsx"
                  onChange={handleFileSelect}
                  className="hidden" 
                />
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0052CC] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Click to Browse or Drop CSV / XLSX File Here'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Supports .csv and .xlsx files up to 10MB (Max 1000 users per batch)
                </p>
              </label>

              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {uploadError}
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-slate-100/70 rounded-xl text-xs">
                <span className="text-slate-600 font-medium">Need the standard import format template?</span>
                <div className="flex gap-2">
                  <a
                    href="/api/v1/admin/users/template?format=csv"
                    download
                    className="text-[#0052CC] font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV Template
                  </a>
                  <span>•</span>
                  <a
                    href="/api/v1/admin/users/template?format=xlsx"
                    download
                    className="text-[#0052CC] font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Excel Template
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Summary Matrix */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#28A745]" />
                  <span className="font-bold text-slate-800">Import Batch Executed Successfully</span>
                </div>
              </div>

              {/* Status Summary Pills */}
              <div className="grid grid-cols-3 gap-3 text-xs text-center font-bold">
                <div className="bg-emerald-50 text-[#28A745] p-3 rounded-xl border border-emerald-100">
                  <span className="text-lg block">{importSummary.imported}</span>
                  Users Provisioned
                </div>
                <div className="bg-amber-50 text-amber-600 p-3 rounded-xl border border-amber-100">
                  <span className="text-lg block">{importSummary.duplicates}</span>
                  Duplicates Skipped
                </div>
                <div className="bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-100">
                  <span className="text-lg block">{importSummary.failed}</span>
                  Failed Rows
                </div>
              </div>

              {importSummary.failed_details && importSummary.failed_details.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 text-xs space-y-2 max-h-40 overflow-y-auto">
                  <h4 className="font-bold text-rose-600">Failed / Rejected Rows</h4>
                  {importSummary.failed_details.map((f: any, i: number) => (
                    <p key={i} className="text-slate-600">
                      <strong>Row #{f.row} ({f.email}):</strong> {f.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            {importSummary ? 'Close' : 'Cancel'}
          </button>

          {!importSummary && selectedFile && (
            <button
              onClick={handleUploadSubmit}
              disabled={isUploading}
              className="px-5 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs inline-flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              {isUploading ? 'Uploading & Provisioning...' : 'Upload & Import Batch'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
