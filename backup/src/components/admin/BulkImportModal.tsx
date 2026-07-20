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

  const [hasFileUploaded, setHasFileUploaded] = useState(false);
  const [fileName, setFileName] = useState('');

  // Mock parsed CSV rows
  const [parsedRows] = useState<CsvImportUserRow[]>([
    { fullName: 'Jordan Vance', email: 'jordan.vance@defense.org', role: 'User', groupName: 'SOC Analysts Batch B', isValid: true },
    { fullName: 'Taylor Reed', email: 'taylor.reed@cybersec.io', role: 'User', groupName: 'Red Team Cohort 2026', isValid: true },
    { fullName: 'Morgan Stanley', email: 'morgan.stanley@invalid-email-domain', role: 'User', groupName: 'Blue Team Defense Alpha', isValid: false, errorMessage: 'Invalid TLD domain syntax' },
    { fullName: 'Sam Mercer', email: 'sam.mercer@enterprise.net', role: 'User', groupName: 'SOC Analysts Batch B', isValid: true },
    { fullName: 'Chris Miller', email: 'chris.m@mitre.org', role: 'Instructor', groupName: 'Red Team Cohort 2026', isValid: true },
  ]);

  const handleSimulateUpload = () => {
    setFileName('cyberrange_user_import_2026.csv');
    setHasFileUploaded(true);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  const handleConfirmImport = () => {
    const validUsersToImport: PlatformUser[] = parsedRows
      .filter((r) => r.isValid)
      .map((r, idx) => ({
        id: `imported-${Date.now()}-${idx}`,
        fullName: r.fullName,
        email: r.email,
        role: r.role as any,
        groupName: r.groupName,
        groupId: 'grp-batch-b',
        status: 'Active',
        joinedDate: 'Just now',
        lastActive: 'Never',
        score: 0,
        completedLabsCount: 0,
      }));

    onImportUsers(validUsersToImport);
    onClose();
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
          {!hasFileUploaded ? (
            /* Upload Drop Area */
            <div className="space-y-4">
              <div
                onClick={handleSimulateUpload}
                className="border-2 border-dashed border-slate-300 hover:border-[#0052CC] bg-slate-50/50 hover:bg-blue-50/40 rounded-2xl p-8 text-center cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0052CC] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Click to Browse or Drop CSV File Here
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Supports .csv files up to 10MB (Max 500 users per batch upload)
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-100/70 rounded-xl text-xs">
                <span className="text-slate-600 font-medium">Need the standard import format template?</span>
                <button
                  type="button"
                  onClick={() => alert('Downloading CSV Schema Template: full_name, email, role, group_name')}
                  className="text-[#0052CC] font-bold hover:underline inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download CSV Template
                </button>
              </div>
            </div>
          ) : (
            /* File Uploaded & Row Preview Matrix */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#28A745]" />
                  <span className="font-bold text-slate-800">{fileName}</span>
                  <span className="text-slate-500">({parsedRows.length} total rows parsed)</span>
                </div>
                <button
                  onClick={() => setHasFileUploaded(false)}
                  className="text-slate-500 hover:text-slate-800 font-bold underline"
                >
                  Change File
                </button>
              </div>

              {/* Status Summary Pill */}
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="bg-emerald-50 text-[#28A745] px-2.5 py-1 rounded-md border border-emerald-100">
                  ✓ {validCount} Ready to Import
                </span>
                {invalidCount > 0 && (
                  <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-md border border-rose-100">
                    ⚠ {invalidCount} Validation Error(s)
                  </span>
                )}
              </div>

              {/* Data Matrix Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2.5">Row Status</th>
                      <th className="p-2.5">Full Name</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Group Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'bg-white' : 'bg-rose-50/50'}>
                        <td className="p-2.5 font-bold">
                          {row.isValid ? (
                            <span className="text-[#28A745] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> {row.errorMessage}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">{row.fullName}</td>
                        <td className="p-2.5 text-slate-600">{row.email}</td>
                        <td className="p-2.5 text-slate-700 font-medium">{row.groupName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          {hasFileUploaded && (
            <button
              onClick={handleConfirmImport}
              className="px-5 py-2.5 rounded-xl bg-[#0052CC] hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs inline-flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Import {validCount} Valid Account(s)
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
