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

/**
 * Frontend-only placeholder used when an admin registers without picking an
 * organization up front (the trimmed registration form only asks for
 * name/email/phone/password). The backend's existing required organization
 * fields still get real string values behind the scenes — this constant is
 * just a name that's obviously not "real" yet, so pages can tell "has this
 * admin configured their org?" apart from a genuine name, without needing
 * any backend flag.
 */
export const UNCONFIGURED_ORG_PREFIX = 'Unconfigured Organization';

export function makeUnconfiguredOrgName(email: string): string {
  return `${UNCONFIGURED_ORG_PREFIX} (${email.trim().toLowerCase()})`;
}

export function isUnconfiguredOrgName(name?: string | null): boolean {
  return !name || !name.trim() || name.trim().startsWith(UNCONFIGURED_ORG_PREFIX);
}

export function apiWebSocketUrl(path: string): string {
  if (/^wss?:\/\//i.test(path)) {
    return path;
  }

  const url = new URL(apiUrl(path), window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
