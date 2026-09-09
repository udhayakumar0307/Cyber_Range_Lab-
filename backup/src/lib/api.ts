export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

/**
 * Canonical frontend API transport.
 * Resolves API paths through VITE_API_URL while preserving native fetch semantics.
 */
export function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(apiUrl(path), {
    ...options,
    credentials: options.credentials ?? 'include',
  });
}

/**
 * Fetch an asset owned by the frontend origin rather than the API origin.
 * Vite serves public/ at / during development and Cloudflare ASSETS serves
 * the built equivalents in production.
 */
export function assetFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  if (/^https?:\/\//i.test(path)) {
    return fetch(path, options);
  }

  const url = new URL(path, window.location.origin);
  return fetch(url.toString(), options);
}

export function apiWebSocketUrl(path: string): string {
  if (/^wss?:\/\//i.test(path)) {
    return path;
  }

  const url = new URL(apiUrl(path), window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
