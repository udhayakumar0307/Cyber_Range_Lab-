export interface SysadminRubricCriterion {
  id: string;
  points: number;
}

export interface SysadminLabSummary {
  lab_id: string;
  title: string;
  version: string;
  module: string;
  difficulty: string;
  learning_objectives: string[];
  submission_filename: string;
  interpreter: string;
  total_points: number;
  pass_score: number;
  rubric: SysadminRubricCriterion[];
}

export interface SysadminLabDetail extends SysadminLabSummary {
  question_markdown: string;
}

export interface SysadminCriterionResult {
  id: string;
  passed: boolean;
  points: number;
  max_points: number;
  feedback: string;
}

export interface SysadminSubmission {
  submission_id: number;
  lab_id: string;
  filename: string;
  status: string;
  score: number | null;
  max_score: number | null;
  pass_score: number | null;
  passed: boolean | null;
  tests: SysadminCriterionResult[];
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  graded_at: string | null;
  error: string | null;
}

export interface SysadminWorkspaceSession {
  workspace_id: string;
  lab_id: string;
  status: string;
  terminal_ready: boolean;
  started_at: string | null;
  expires_at: string | null;
}

export type AuthenticatedFetch = (url: string, options?: RequestInit) => Promise<Response>;

async function apiJson<T>(
  apiFetch: AuthenticatedFetch,
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await apiFetch(url, options);
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  let detail = `Request failed with status ${response.status}`;
  try {
    const payload = await response.json();
    const rawDetail = payload?.detail;
    if (typeof rawDetail === 'string') detail = rawDetail;
    else if (rawDetail?.message) detail = String(rawDetail.message);
  } catch {
    // Keep generic HTTP error if the backend did not return JSON.
  }
  throw new Error(detail);
}

export const sysadminGradingService = {
  listLabs(apiFetch: AuthenticatedFetch): Promise<SysadminLabSummary[]> {
    return apiJson(apiFetch, '/api/v1/sysadmin-grading/labs');
  },

  getLab(apiFetch: AuthenticatedFetch, labId: string): Promise<SysadminLabDetail> {
    return apiJson(apiFetch, `/api/v1/sysadmin-grading/labs/${encodeURIComponent(labId)}`);
  },

  listSubmissions(
    apiFetch: AuthenticatedFetch,
    labId: string,
    limit = 10,
  ): Promise<SysadminSubmission[]> {
    const params = new URLSearchParams({ lab_id: labId, limit: String(limit) });
    return apiJson(apiFetch, `/api/v1/sysadmin-grading/submissions?${params.toString()}`);
  },

  getWorkspace(apiFetch: AuthenticatedFetch): Promise<SysadminWorkspaceSession | null> {
    return apiJson(apiFetch, '/api/v1/sysadmin-grading/workspaces/session');
  },

  startWorkspace(
    apiFetch: AuthenticatedFetch,
    labId: string,
  ): Promise<SysadminWorkspaceSession> {
    return apiJson(apiFetch, '/api/v1/sysadmin-grading/workspaces/start', {
      method: 'POST',
      body: JSON.stringify({ lab_id: labId }),
    });
  },

  stopWorkspace(apiFetch: AuthenticatedFetch): Promise<{ stopped: boolean }> {
    return apiJson(apiFetch, '/api/v1/sysadmin-grading/workspaces/session', {
      method: 'DELETE',
    });
  },
};
