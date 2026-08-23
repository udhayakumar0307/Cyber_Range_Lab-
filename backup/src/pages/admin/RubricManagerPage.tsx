import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
} from 'lucide-react';

type LabOption = {
  lab_id: string;
  lab_name: string;
  category: string;
  module_count: number;
  active_rubric_id: number | null;
  active_version: number | null;
  active_rubric_name: string | null;
};

type ModuleOption = {
  id: string;
  title: string;
  points: number;
  track: string;
};

type Criterion = {
  key: string;
  title: string;
  description: string;
  weight_percent: number;
  grading_mode: 'AUTO' | 'MANUAL';
  evidence: {
    type: string;
    module_ids?: string[];
    event_types?: string[];
  };
  performance_levels?: Array<{
    label: string;
    min_percent: number;
    description: string;
  }>;
};

type RubricDraft = {
  name: string;
  description: string;
  criteria: Criterion[];
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

export const RubricManagerPage: React.FC = () => {
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [draft, setDraft] = useState<RubricDraft | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const loadLabs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/rubrics/labs', { headers });
      const body = await res.json().catch(() => []);
      if (!res.ok) throw new Error(body.detail || 'Failed to load labs.');
      setLabs(body);
      if (!selectedLabId && body.length > 0) {
        setSelectedLabId(body[0].lab_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load labs.');
    } finally {
      setLoading(false);
    }
  };

  const loadLabRubric = async (labId: string) => {
    if (!labId) return;
    setLoading(true);
    setError('');
    try {
      const [rubricRes, moduleRes] = await Promise.all([
        fetch(`/api/v1/rubrics/labs/${labId}`, { headers }),
        fetch(`/api/v1/rubrics/labs/${labId}/modules`, { headers }),
      ]);

      const rubricBody = await rubricRes.json().catch(() => ({}));
      const moduleBody = await moduleRes.json().catch(() => []);

      if (!rubricRes.ok) {
        throw new Error(rubricBody.detail || 'Failed to load rubric.');
      }
      if (!moduleRes.ok) {
        throw new Error(moduleBody.detail || 'Failed to load modules.');
      }

      setModules(moduleBody);
      setCanManage(Boolean(rubricBody.can_manage));

      const source = rubricBody.active?.rubric || rubricBody.default_preview;
      setDraft({
        name: source.name || 'Lab Rubric',
        description: source.description || '',
        criteria: (source.criteria || []).map((criterion: Criterion) => ({
          ...criterion,
          evidence: {
            ...criterion.evidence,
            module_ids: [...(criterion.evidence?.module_ids || [])],
            event_types: [...(criterion.evidence?.event_types || [])],
          },
        })),
      });
      setActiveVersion(rubricBody.active?.version ?? null);
    } catch (err: any) {
      setError(err.message || 'Failed to load rubric.');
      setDraft(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  useEffect(() => {
    if (selectedLabId) {
      loadLabRubric(selectedLabId);
    }
  }, [selectedLabId]);

  const weightTotal = useMemo(
    () =>
      draft
        ? Math.round(
            draft.criteria.reduce(
              (sum, criterion) => sum + Number(criterion.weight_percent || 0),
              0
            ) * 100
          ) / 100
        : 0,
    [draft]
  );

  const patchCriterion = (index: number, patch: Partial<Criterion>) => {
    setDraft((current) => {
      if (!current) return current;
      const criteria = [...current.criteria];
      const existing = criteria[index];
      criteria[index] = {
        ...existing,
        ...patch,
        evidence: patch.evidence
          ? { ...existing.evidence, ...patch.evidence }
          : existing.evidence,
      };
      return { ...current, criteria };
    });
  };

  const addCriterion = () => {
    setDraft((current) => {
      if (!current) return current;
      const number = current.criteria.length + 1;
      return {
        ...current,
        criteria: [
          ...current.criteria,
          {
            key: `manual-${number}`,
            title: `Manual Criterion ${number}`,
            description: '',
            weight_percent: 10,
            grading_mode: 'MANUAL',
            evidence: { type: 'MANUAL' },
          },
        ],
      };
    });
  };

  const removeCriterion = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        criteria: current.criteria.filter((_, i) => i !== index),
      };
    });
  };

  const saveNewVersion = async () => {
    if (!canManage) {
      setError('This lab rubric template is platform-global. Only a system administrator can publish a new template version.');
      return;
    }
    if (!draft || !selectedLabId) return;
    if (Math.abs(weightTotal - 100) > 0.01) {
      setError(`Rubric weights must total 100%. Current total: ${weightTotal}%.`);
      return;
    }

    const confirmed = window.confirm(
      'Save this as a new active rubric version? Existing assignment snapshots will remain unchanged.'
    );
    if (!confirmed) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/v1/rubrics/labs/${selectedLabId}/versions`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(draft),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Failed to save rubric.');

      showToast(`Rubric version ${body.version} published.`);
      await loadLabs();
      await loadLabRubric(selectedLabId);
    } catch (err: any) {
      setError(err.message || 'Failed to save rubric.');
    } finally {
      setSaving(false);
    }
  };

  const regenerateDefault = async () => {
    if (!canManage) {
      setError('This lab rubric template is platform-global. Only a system administrator can regenerate it.');
      return;
    }
    if (!selectedLabId) return;

    const confirmed = window.confirm(
      'Generate and publish a new default rubric from current LabModule points? Existing assignment snapshots will remain unchanged.'
    );
    if (!confirmed) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/v1/rubrics/labs/${selectedLabId}/generate-default`,
        {
          method: 'POST',
          headers,
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || 'Failed to generate default rubric.');
      }
      showToast(`Default rubric version ${body.version} generated.`);
      await loadLabs();
      await loadLabRubric(selectedLabId);
    } catch (err: any) {
      setError(err.message || 'Failed to generate default rubric.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800 dark:text-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-violet-600" />
            <h1 className="text-xl font-black text-slate-950 dark:text-white">
              Lab Rubrics
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-slate-500">
            Define versioned, machine-readable grading criteria. New assignments
            snapshot the active version; existing assignment rubrics never change.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadLabs();
            if (selectedLabId) loadLabRubric(selectedLabId);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="mb-2 block text-[10px] font-black uppercase text-slate-400">
          Lab
        </label>
        <select
          value={selectedLabId}
          onChange={(e) => setSelectedLabId(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800"
        >
          {labs.map((lab) => (
            <option key={lab.lab_id} value={lab.lab_id}>
              {lab.lab_name} — {lab.module_count} modules
              {lab.active_version ? ` — rubric v${lab.active_version}` : ' — no saved rubric'}
            </option>
          ))}
        </select>
      </div>

      {!loading && draft && !canManage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
          Read-only template view. Professors can grade manual rubric criteria from the Gradebook, but only a system administrator can change this platform-global lab rubric template.
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          Loading rubric…
        </div>
      )}

      {!loading && draft && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                Rubric Name
              </label>
              <input
                value={draft.name}
                onChange={(e) =>
                  setDraft((current) =>
                    current ? { ...current, name: e.target.value } : current
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="rounded-xl bg-slate-50 px-4 py-2 dark:bg-slate-800">
                <div className="text-[9px] font-black uppercase text-slate-400">
                  Active Version
                </div>
                <div className="mt-1 font-black">
                  {activeVersion ? `v${activeVersion}` : 'Preview only'}
                </div>
              </div>
              <div
                className={`rounded-xl px-4 py-2 ${
                  Math.abs(weightTotal - 100) <= 0.01
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                <div className="text-[9px] font-black uppercase">Weight Total</div>
                <div className="mt-1 font-black">{weightTotal}%</div>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
              Description
            </label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) =>
                setDraft((current) =>
                  current ? { ...current, description: e.target.value } : current
                )
              }
              className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="space-y-3">
            {draft.criteria.map((criterion, index) => (
              <div
                key={`${criterion.key}-${index}`}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="grid gap-3 lg:grid-cols-[1.2fr_110px_130px_auto]">
                  <div>
                    <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                      Criterion
                    </label>
                    <input
                      value={criterion.title}
                      onChange={(e) =>
                        patchCriterion(index, {
                          title: e.target.value,
                          key: criterion.key || slug(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-bold outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                      Weight %
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step="0.01"
                      value={criterion.weight_percent}
                      onChange={(e) =>
                        patchCriterion(index, {
                          weight_percent: Number(e.target.value || 0),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-black outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                      Grading Mode
                    </label>
                    <select
                      value={criterion.grading_mode}
                      onChange={(e) => {
                        const mode = e.target.value as 'AUTO' | 'MANUAL';
                        patchCriterion(index, {
                          grading_mode: mode,
                          evidence:
                            mode === 'AUTO'
                              ? modules.length > 0
                                ? {
                                    type: 'MODULES',
                                    module_ids:
                                      criterion.evidence.module_ids?.length
                                        ? criterion.evidence.module_ids
                                        : [modules[0].id],
                                    event_types: [
                                      'MODULE_COMPLETION',
                                      'HINT_PENALTY',
                                    ],
                                  }
                                : {
                                    type: 'ASSIGNMENT_EVENTS',
                                    event_types: [
                                      'MODULE_COMPLETION',
                                      'HINT_PENALTY',
                                    ],
                                  }
                              : { type: 'MANUAL' },
                        });
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-black outline-none dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="AUTO">AUTO</option>
                      <option value="MANUAL">MANUAL</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeCriterion(index)}
                      className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                    Description
                  </label>
                  <input
                    value={criterion.description}
                    onChange={(e) =>
                      patchCriterion(index, { description: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                {criterion.grading_mode === 'AUTO' && (
                  <div className="mt-3">
                    <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                      Automatic Evidence
                    </label>
                    {modules.length > 0 ? (
                      <>
                        <select
                          multiple
                          value={criterion.evidence.module_ids || []}
                          onChange={(e) =>
                            patchCriterion(index, {
                              evidence: {
                                ...criterion.evidence,
                                type: 'MODULES',
                                module_ids: Array.from(
                                  e.target.selectedOptions as HTMLCollectionOf<HTMLOptionElement>,
                                  (option: HTMLOptionElement) => option.value
                                ),
                                event_types: [
                                  'MODULE_COMPLETION',
                                  'HINT_PENALTY',
                                ],
                              },
                            })
                          }
                          className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none dark:border-slate-700 dark:bg-slate-800"
                        >
                          {modules.map((module) => (
                            <option key={module.id} value={module.id}>
                              {module.title} — {module.points} pts — {module.id}
                            </option>
                          ))}
                        </select>
                        <div className="mt-1 text-[9px] text-slate-400">
                          Ctrl/Cmd-click to select multiple modules. Hint penalties
                          are included as negative evidence for mapped modules.
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-700">
                        This lab has no LabModule rows. Automatic grading uses all
                        assignment-scoped completion and hint-penalty ScoreEvents
                        against the lab's max_points value.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={addCriterion}
              disabled={!canManage}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Plus className="h-4 w-4" />
              Add Manual Criterion
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={regenerateDefault}
                disabled={saving || !canManage}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 font-black text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Generate Default
              </button>
              <button
                type="button"
                onClick={saveNewVersion}
                disabled={saving || !canManage || Math.abs(weightTotal - 100) > 0.01}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-black text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Publish New Version'}
              </button>
            </div>
          </div>
        </div>
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
