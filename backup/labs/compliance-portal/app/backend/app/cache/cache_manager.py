import time

class CacheManager:
    def __init__(self):
        self.cache = {}
        self.ttl = 60 # 1 minute in seconds

    def set(self, key: str, value: any, custom_ttl: int = None):
        expires_at = time.time() + (custom_ttl or self.ttl)
        self.cache[key] = {"value": value, "expires_at": expires_at}

    def get(self, key: str) -> any:
        entry = self.cache.get(key)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            del self.cache[key]
            return None
        return entry["value"]

    def invalidate(self, key: str):
        if key in self.cache:
            del self.cache[key]

    def invalidate_all(self):
        self.cache.clear()

cache_manager = CacheManager()
