export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

/**
 * Canonical frontend HTTP client.
 *
 * Responsibilities:
 * - Resolve API paths through VITE_API_URL.
 * - Preserve absolute URLs when explicitly supplied.
 * - Attach a Bearer token when provided.
 * - Preserve an explicitly supplied Authorization header.
 * - Send cookies by default.
 * - Set JSON Content-Type automatically for non-FormData request bodies.
 *
 * Authentication/session policy remains owned by AuthContext.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const {
    token,
    headers: initialHeaders,
    credentials,
    ...requestOptions
  } = options;

  const headers = new Headers(initialHeaders || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (
    requestOptions.body &&
    !headers.has('Content-Type') &&
    !(requestOptions.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(apiUrl(path), {
    ...requestOptions,
    headers,
    credentials: credentials ?? 'include',
  });
}
