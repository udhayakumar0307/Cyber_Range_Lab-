import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Lock,
  RefreshCcw,
  Save,
  Search,
  Send,
  Unlock,
  Users,
} from 'lucide-react';

type AssignmentOption = {
  assignment_id: number;
  lab_id: string;
  lab_title: string;
  group_id: number | null;
  student_id: number | null;
  student_count: number;
  start_datetime: string | null;
  end_datetime: string | null;
  status: string;
};

type GradeRow = {
  student_id: number;
  student_name: string;
  email: string;
  department: string;
  year: string;
  auto_score_earned: number;
  score_possible: number;
  auto_percent: number;
  manual_adjustment: number;
  final_percent: number;
  feedback: string;
  grade_status: 'DRAFT' | 'PUBLISHED';
  published_at: string | null;
  graded_by: number | null;
  completed_modules: number;
  total_modules: number;
  completion_percent: number | null;
  attempts: number;
  completion_time_seconds: number;
  last_activity_at: string | null;
  score_source: string;
};

type GradebookData = {
  assignment: {
    id: number;
    lab_id: string;
    lab_title: string;
    group_id: number | null;
    group_name: string | null;
    student_id: number | null;
    start_datetime: string | null;
    end_datetime: string | null;
    status: string;
  };
  summary: {
    student_count: number;
    draft_count: number;
    published_count: number;
    average_auto_percent: number;
    average_final_percent: number;
    score_possible: number;
    score_source: string;
  };
  students: GradeRow[];
};

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value * 100) / 100));

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

const formatDuration = (seconds: number) => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const GradebookPage: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [gradebook, setGradebook] = useState<GradebookData | null>(null);
  const [draftRows, setDraftRows] = useState<Record<number, GradeRow>>({});
  const [search, setSearch] = useState('');
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingGradebook, setLoadingGradebook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const token = localStorage.getItem('token');
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const loadAssignments = async () => {
    setLoadingAssignments(true);
    setError('');
    try {
      const res = await fetch('/api/v1/gradebook/assignments', {
        headers: authHeaders,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to load assignments.');
      }

      const data: AssignmentOption[] = await res.json();
      setAssignments(data);

      if (data.length > 0 && selectedAssignmentId === null) {
        setSelectedAssignmentId(data[0].assignment_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments.');
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadGradebook = async (assignmentId: number) => {
    setLoadingGradebook(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/gradebook/assignments/${assignmentId}`, {
        headers: authHeaders,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to load gradebook.');
      }

      const data: GradebookData = await res.json();
      setGradebook(data);

      const byId: Record<number, GradeRow> = {};
      data.students.forEach((row) => {
        byId[row.student_id] = { ...row };
      });
      setDraftRows(byId);
    } catch (err: any) {
      setError(err.message || 'Failed to load gradebook.');
      setGradebook(null);
      setDraftRows({});
    } finally {
      setLoadingGradebook(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    if (selectedAssignmentId !== null) {
      loadGradebook(selectedAssignmentId);
    }
  }, [selectedAssignmentId]);

  const rows = useMemo(() => {
    if (!gradebook) return [];

    const query = search.trim().toLowerCase();
    return gradebook.students
      .map((base) => draftRows[base.student_id] || base)
      .filter((row) => {
        if (!query) return true;
        return (
          row.student_name.toLowerCase().includes(query) ||
          row.email.toLowerCase().includes(query) ||
          (row.department || '').toLowerCase().includes(query)
        );
      });
  }, [gradebook, draftRows, search]);

  const allPublished =
    gradebook !== null &&
    gradebook.students.length > 0 &&
    gradebook.students.every((row) => row.grade_status === 'PUBLISHED');

  const anyPublished =
    gradebook?.students.some((row) => row.grade_status === 'PUBLISHED') || false;

  const updateRow = (
    studentId: number,
    patch: Partial<Pick<GradeRow, 'manual_adjustment' | 'feedback'>>
  ) => {
    setDraftRows((current) => {
      const existing = current[studentId];
      if (!existing || existing.grade_status === 'PUBLISHED') return current;

      const adjustment =
        patch.manual_adjustment !== undefined
          ? patch.manual_adjustment
          : existing.manual_adjustment;

      const finalPercent = clampPercent(existing.auto_percent + adjustment);

      return {
        ...current,
        [studentId]: {
          ...existing,
          ...patch,
          manual_adjustment: adjustment,
          final_percent: finalPercent,
        },
      };
    });
  };

  const saveDrafts = async () => {
    if (!gradebook || selectedAssignmentId === null) return;

    const editableRows = Object.values(draftRows).filter(
      (row) => row.grade_status !== 'PUBLISHED'
    );

    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/v1/gradebook/assignments/${selectedAssignmentId}`,
        {
          method: 'PUT',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grades: editableRows.map((row) => ({
              student_id: row.student_id,
              manual_adjustment: Number(row.manual_adjustment || 0),
              feedback: row.feedback || '',
            })),
          }),
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || 'Failed to save gradebook.');
      }

      setGradebook(body.gradebook);
      const byId: Record<number, GradeRow> = {};
      body.gradebook.students.forEach((row: GradeRow) => {
        byId[row.student_id] = { ...row };
      });
      setDraftRows(byId);
      showToast(`Saved ${body.updated_rows} draft grade${body.updated_rows === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to save gradebook.');
    } finally {
      setSaving(false);
    }
  };

  const publishAll = async () => {
    if (selectedAssignmentId === null) return;

    const confirmed = window.confirm(
      'Publish all grades for this assignment? Published grades are frozen until you reopen the gradebook.'
    );
    if (!confirmed) return;

    setPublishing(true);
    setError('');
    try {
      // Save current draft edits first.
      if (!allPublished) {
        const editableRows = Object.values(draftRows).filter(
          (row) => row.grade_status !== 'PUBLISHED'
        );

        const saveRes = await fetch(
          `/api/v1/gradebook/assignments/${selectedAssignmentId}`,
          {
            method: 'PUT',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grades: editableRows.map((row) => ({
                student_id: row.student_id,
                manual_adjustment: Number(row.manual_adjustment || 0),
                feedback: row.feedback || '',
              })),
            }),
          }
        );

        if (!saveRes.ok) {
          const saveBody = await saveRes.json().catch(() => ({}));
          throw new Error(saveBody.detail || 'Could not save drafts before publishing.');
        }
      }

      const res = await fetch(
        `/api/v1/gradebook/assignments/${selectedAssignmentId}/publish`,
        {
          method: 'POST',
          headers: authHeaders,
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || 'Failed to publish gradebook.');
      }

      setGradebook(body.gradebook);
      const byId: Record<number, GradeRow> = {};
      body.gradebook.students.forEach((row: GradeRow) => {
        byId[row.student_id] = { ...row };
      });
      setDraftRows(byId);
      showToast(`Published ${body.published_rows} grade${body.published_rows === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to publish gradebook.');
    } finally {
      setPublishing(false);
    }
  };

  const reopen = async () => {
    if (selectedAssignmentId === null) return;

    const confirmed = window.confirm(
      'Reopen this gradebook? Published grades will return to draft state and begin reflecting current automatic scoring again.'
    );
    if (!confirmed) return;

    setPublishing(true);
    setError('');
    try {
      const res = await fetch(
        `/api/v1/gradebook/assignments/${selectedAssignmentId}/reopen`,
        {
          method: 'POST',
          headers: authHeaders,
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || 'Failed to reopen gradebook.');
      }

      setGradebook(body.gradebook);
      const byId: Record<number, GradeRow> = {};
      body.gradebook.students.forEach((row: GradeRow) => {
        byId[row.student_id] = { ...row };
      });
      setDraftRows(byId);
      showToast('Gradebook reopened.');
    } catch (err: any) {
      setError(err.message || 'Failed to reopen gradebook.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800 dark:text-slate-200">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-black text-slate-950 dark:text-white">
              Professor Gradebook
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-slate-500">
            Review automatic assignment scores, apply percentage-point adjustments,
            leave feedback, and publish stable final grades.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            loadAssignments();
            if (selectedAssignmentId !== null) {
              loadGradebook(selectedAssignmentId);
            }
          }}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-400">
          Assignment
        </label>
        <div className="relative">
          <select
            value={selectedAssignmentId ?? ''}
            onChange={(e) =>
              setSelectedAssignmentId(e.target.value ? Number(e.target.value) : null)
            }
            disabled={loadingAssignments}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {assignments.length === 0 && <option value="">No assignments available</option>}
            {assignments.map((assignment) => (
              <option key={assignment.assignment_id} value={assignment.assignment_id}>
                #{assignment.assignment_id} — {assignment.lab_title} — {assignment.student_count} student{assignment.student_count === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {loadingGradebook && (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          Loading gradebook…
        </div>
      )}

      {!loadingGradebook && gradebook && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: 'Students',
                value: gradebook.summary.student_count,
                icon: Users,
              },
              {
                label: 'Average Auto',
                value: `${gradebook.summary.average_auto_percent}%`,
                icon: BookOpenCheck,
              },
              {
                label: 'Average Final',
                value: `${gradebook.summary.average_final_percent}%`,
                icon: CheckCircle2,
              },
              {
                label: 'Draft',
                value: gradebook.summary.draft_count,
                icon: Unlock,
              },
              {
                label: 'Published',
                value: gradebook.summary.published_count,
                icon: Lock,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    {label}
                  </span>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-lg font-black text-slate-950 dark:text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-black text-slate-950 dark:text-white">
                  {gradebook.assignment.lab_title}
                </h2>
                <p className="mt-1 text-slate-500">
                  Assignment #{gradebook.assignment.id}
                  {gradebook.assignment.group_name
                    ? ` • ${gradebook.assignment.group_name}`
                    : ''}
                  {' • '}
                  {formatDate(gradebook.assignment.start_datetime)}
                  {' → '}
                  {formatDate(gradebook.assignment.end_datetime)}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  Automatic denominator: {gradebook.summary.score_possible || 'Unavailable'} points
                  {' • '}
                  source: {gradebook.summary.score_source}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {anyPublished ? (
                  <button
                    type="button"
                    onClick={reopen}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 font-black text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Unlock className="h-4 w-4" />
                    Reopen Gradebook
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={saveDrafts}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving…' : 'Save Drafts'}
                    </button>
                    <button
                      type="button"
                      onClick={publishAll}
                      disabled={publishing || gradebook.students.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 font-black text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {publishing ? 'Publishing…' : 'Publish All'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-400 dark:border-slate-700 dark:bg-slate-800/60">
                    <th className="p-3">Student</th>
                    <th className="p-3 text-center">Progress</th>
                    <th className="p-3 text-center">Auto Score</th>
                    <th className="p-3 text-center">Auto %</th>
                    <th className="p-3 text-center">Adjustment</th>
                    <th className="p-3 text-center">Final %</th>
                    <th className="p-3">Feedback</th>
                    <th className="p-3 text-center">Attempts</th>
                    <th className="p-3 text-center">Time</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => {
                    const locked = row.grade_status === 'PUBLISHED';
                    return (
                      <tr key={row.student_id} className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                        <td className="p-3">
                          <div className="font-black text-slate-950 dark:text-white">
                            {row.student_name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {row.email}
                          </div>
                          {(row.department || row.year) && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {[row.department, row.year].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <div className="font-black">
                            {row.completion_percent === null
                              ? '—'
                              : `${row.completion_percent}%`}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {row.completed_modules}
                            {row.total_modules > 0 ? ` / ${row.total_modules}` : ''} modules
                          </div>
                        </td>

                        <td className="p-3 text-center font-black">
                          {row.auto_score_earned}
                          <span className="font-semibold text-slate-400">
                            {' / '}
                            {row.score_possible || '—'}
                          </span>
                        </td>

                        <td className="p-3 text-center font-black text-blue-600 dark:text-blue-400">
                          {row.auto_percent}%
                        </td>

                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min={-100}
                            max={100}
                            step="0.5"
                            value={row.manual_adjustment}
                            disabled={locked}
                            onChange={(e) =>
                              updateRow(row.student_id, {
                                manual_adjustment: Math.max(
                                  -100,
                                  Math.min(100, Number(e.target.value || 0))
                                ),
                              })
                            }
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center font-black outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-850"
                          />
                          <div className="mt-1 text-[9px] text-slate-400">percentage points</div>
                        </td>

                        <td className="p-3 text-center">
                          <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {row.final_percent}%
                          </span>
                        </td>

                        <td className="p-3">
                          <textarea
                            rows={2}
                            value={row.feedback}
                            disabled={locked}
                            onChange={(e) =>
                              updateRow(row.student_id, {
                                feedback: e.target.value,
                              })
                            }
                            placeholder="Professor feedback…"
                            className="min-w-[220px] w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-850"
                          />
                        </td>

                        <td className="p-3 text-center font-bold">{row.attempts || '—'}</td>
                        <td className="p-3 text-center text-slate-500">
                          {formatDuration(row.completion_time_seconds)}
                        </td>

                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black ${
                              locked
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                          >
                            {locked ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <Unlock className="h-3 w-3" />
                            )}
                            {row.grade_status}
                          </span>
                          {row.published_at && (
                            <div className="mt-1 whitespace-nowrap text-[9px] text-slate-400">
                              {formatDate(row.published_at)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-12 text-center font-bold text-slate-400">
                        No students match this gradebook.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-bold text-white shadow-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
};
