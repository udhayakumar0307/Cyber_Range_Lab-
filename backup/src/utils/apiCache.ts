/**
 * apiCache.ts — In-Memory API Response Cache with Request Deduplication
 * ======================================================================
 *
 * Two features:
 *
 * 1. TTL Cache — stores JSON responses for a configurable number of seconds.
 *    Avoids refetching static or semi-static data (lab metadata, achievements).
 *
 * 2. Request Deduplication — if the same URL is in-flight, subsequent callers
 *    receive the same Promise. Prevents duplicate parallel requests that occur
 *    when multiple components mount simultaneously (e.g. labs page + dashboard).
 *
 * Usage:
 *   import { cachedFetch } from '../utils/apiCache';
 *
 *   // Cache for 5 minutes:
 *   const labs = await cachedFetch(apiFetch, '/api/v1/labs', { ttl: 300 });
 *
 *   // Bypass cache (force fresh):
 *   const labs = await cachedFetch(apiFetch, '/api/v1/labs', { ttl: 0 });
 *
 *   // Invalidate a cache entry:
 *   invalidateCacheEntry('/api/v1/labs');
 *
 * Security notes:
 *   - NEVER cache user-sensitive mutable data (scores, profile, progress).
 *   - Cache ONLY static / semi-static data: lab metadata, achievement defs, colleges.
 *   - Cache is in-memory — cleared on page reload. No localStorage persistence.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // monotonic timestamp (ms)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _cache = new Map<string, CacheEntry<any>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _inFlight = new Map<string, Promise<any>>();

export type ApiFetchFn = (url: string, options?: RequestInit) => Promise<Response>;

interface CachedFetchOptions {
  /** Cache lifetime in seconds. 0 = bypass cache entirely. Default: 300 (5 min) */
  ttl?: number;
}

/**
 * Fetch JSON data with caching and request deduplication.
 *
 * - On cache HIT (data exists and not expired): returns immediately from memory.
 * - On IN-FLIGHT (same URL already being fetched): waits for that Promise.
 * - On cache MISS: fetches, caches, and returns.
 */
export async function cachedFetch<T = unknown>(
  fetchFn: ApiFetchFn,
  url: string,
  { ttl = 300 }: CachedFetchOptions = {},
): Promise<T> {
  const now = performance.now();

  // Cache hit
  if (ttl > 0) {
    const entry = _cache.get(url);
    if (entry && now < entry.expiresAt) {
      return entry.data as T;
    }
  }

  // Deduplicate in-flight requests
  const existing = _inFlight.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetchFn(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res.json() as Promise<T>;
    })
    .then((data) => {
      if (ttl > 0) {
        _cache.set(url, { data, expiresAt: performance.now() + ttl * 1000 });
      }
      _inFlight.delete(url);
      return data;
    })
    .catch((err) => {
      _inFlight.delete(url);
      throw err;
    });

  _inFlight.set(url, promise);
  return promise;
}

/**
 * Explicitly invalidate a cached URL (e.g., after submitting a flag).
 */
export function invalidateCacheEntry(url: string): void {
  _cache.delete(url);
}

/**
 * Clear all cached entries (e.g., on logout).
 */
export function clearAllCache(): void {
  _cache.clear();
  // Note: _inFlight is left — those promises will resolve/reject naturally
}

/**
 * Return current cache stats (for debugging).
 */
export function getCacheStats(): { size: number; keys: string[] } {
  const now = performance.now();
  const keys = [..._cache.entries()]
    .filter(([, v]) => now < v.expiresAt)
    .map(([k]) => k);
  return { size: keys.length, keys };
}
