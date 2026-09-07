class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = 60 * 1000; // 1 minute TTL by default
  }

  set(key, value, customTtl) {
    const expiresAt = Date.now() + (customTtl || this.ttl);
    this.cache.set(key, { value, expiresAt });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  invalidate(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  invalidateAll() {
    this.cache.clear();
  }
}

export const cacheManager = new CacheManager();
