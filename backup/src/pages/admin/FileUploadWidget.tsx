import React, { useRef, useState } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import type { CtfChallengeFile } from '../../types/ctf';

interface FileUploadWidgetProps {
  files: File[];
  onChange: (files: File[]) => void;
  existingFiles?: CtfChallengeFile[];
  onRemoveExisting?: (fileId: number) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200 MB

export const FileUploadWidget: React.FC<FileUploadWidgetProps> = ({
  files,
  onChange,
  existingFiles = [],
  onRemoveExisting,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate current sizes
  const newFilesSize = files.reduce((acc, f) => acc + f.size, 0);
  const existingFilesSize = existingFiles.reduce((acc, f) => acc + f.file_size_bytes, 0);
  const totalSize = newFilesSize + existingFilesSize;
  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
  const quotaPercent = Math.min((totalSize / MAX_TOTAL_SIZE) * 100, 100);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);

    // Validate individual file sizes
    for (const f of selected) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`File "${f.name}" exceeds the 50 MB limit.`);
        return;
      }
    }

    // Validate total size
    const pendingTotal = totalSize + selected.reduce((acc, f) => acc + f.size, 0);
    if (pendingTotal > MAX_TOTAL_SIZE) {
      setError('Total upload size for this challenge would exceed the 200 MB limit.');
      return;
    }

    onChange([...files, ...selected]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeNewFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
    setError(null);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm font-medium text-slate-700 dark:text-slate-300">
        <span>Challenge Files</span>
        <span className={totalSize > MAX_TOTAL_SIZE ? 'text-rose-500' : 'text-slate-500'}>
          {totalSizeMB} MB / 200 MB
        </span>
      </div>

      {/* Quota Bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            quotaPercent > 90 ? 'bg-rose-500' : quotaPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${quotaPercent}%` }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-colors"
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 block">
          Click to upload files
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 block">
          Max 50 MB per file. Total limit 200 MB.
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* File List */}
      {(existingFiles.length > 0 || files.length > 0) && (
        <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Existing Files */}
          {existingFiles.map((file) => (
            <div
              key={file.id}
              className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <div className="flex items-center gap-2 overflow-hidden mr-4">
                <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {file.filename}
                </span>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">
                  ({formatBytes(file.file_size_bytes)}) [Uploaded]
                </span>
              </div>
              {onRemoveExisting && (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(file.id)}
                  className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {/* New Files */}
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/35 shadow-sm"
            >
              <div className="flex items-center gap-2 overflow-hidden mr-4">
                <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300 truncate">
                  {file.name}
                </span>
                <span className="text-xs text-indigo-400 font-mono flex-shrink-0">
                  ({formatBytes(file.size)}) [Pending]
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeNewFile(idx)}
                className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
