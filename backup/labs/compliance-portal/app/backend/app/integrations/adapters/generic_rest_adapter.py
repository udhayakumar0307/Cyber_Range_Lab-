import urllib.request
import urllib.error
import json
from app.integrations.adapters.base_adapter import BaseAdapter

class GenericRESTAdapter(BaseAdapter):
    def __init__(self, base_url: str, api_key: str = None, platform: str = "Custom REST"):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.platform = platform
        print(f"[GenericRESTAdapter] Instantiated with URL: '{self.base_url}' and Key Prefix: '{self.api_key[:6] if self.api_key else 'None'}...' (len={len(self.api_key) if self.api_key else 0})")

    def _build_headers(self) -> dict:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def verify_connection(self) -> bool:
        """Try health check, then root, then graphql ping, then consents."""
        from urllib.parse import urlparse
        try:
            parsed = urlparse(self.base_url)
            is_local = parsed.hostname in ["localhost", "127.0.0.1", "::1", "0.0.0.0"]
            if is_local and (parsed.port == 8000 or "8000" in self.base_url):
                print(f"[GenericRESTAdapter] Bypassing connection check to self ({self.base_url}) to prevent deadlock.")
                return True
        except Exception:
            pass

        paths_to_try = ["/consent-api/consents", "/health", "/", "/api", "/consents"]
        if self.base_url.count("/") >= 3:
            paths_to_try.insert(0, "")

        for path in paths_to_try:
            try:
                url = f"{self.base_url}{path}"
                print(f"[GenericRESTAdapter] Verifying connection to: {url} with API Key prefix: '{self.api_key[:6] if self.api_key else 'None'}...' (len={len(self.api_key) if self.api_key else 0})")
                req = urllib.request.Request(url, method="GET")
                for k, v in self._build_headers().items():
                    req.add_header(k, v)
                with urllib.request.urlopen(req, timeout=5) as r:
                    if r.status < 500:
                        print(f"[GenericRESTAdapter] Connection verified. Status: {r.status}")
                        return True
            except urllib.error.HTTPError as e:
                if e.code < 500:
                    print(f"[GenericRESTAdapter] Connection verified with HTTPError: {e.code}")
                    return True
            except Exception as e:
                print(f"[GenericRESTAdapter] Connection failed for path {path}. Error: {e}")
                continue
        return False

    async def fetch_customers(self) -> list:
        from urllib.parse import urlparse
        try:
            parsed = urlparse(self.base_url)
            is_local = parsed.hostname in ["localhost", "127.0.0.1", "::1", "0.0.0.0"]
            if is_local and (parsed.port == 8000 or "8000" in self.base_url):
                print(f"[GenericRESTAdapter] Bypassing fetch to self ({self.base_url}) to prevent deadlock.")
                return []
        except Exception:
            pass

        # Strategy 1: EverShop-style GraphQL
        if "EverShop" in self.platform or "evershop" in self.base_url.lower():
            result = await self._fetch_evershop_graphql()
            if result is not None:
                return result

        # Strategy 2: Standard REST endpoints
        rest_paths = ["/consent-api/consents", "/consents", "/customers", "/api/customers", "/api/v1/customers", "/api/v2/customers"]
        paths_to_try = list(rest_paths)
        if self.base_url.count("/") >= 3:
            paths_to_try.insert(0, "")

        for path in paths_to_try:
            try:
                url = f"{self.base_url}{path}"
                print(f"[GenericRESTAdapter] Fetching customers from: {url} with API Key prefix: '{self.api_key[:6] if self.api_key else 'None'}...' (len={len(self.api_key) if self.api_key else 0})")
                req = urllib.request.Request(url, method="GET")
                for k, v in self._build_headers().items():
                    req.add_header(k, v)
                with urllib.request.urlopen(req, timeout=5) as response:
                    raw = json.loads(response.read().decode())
                    if isinstance(raw, list):
                        print(f"[GenericRESTAdapter] Successfully fetched {len(raw)} customers (list format).")
                        return raw
                    # Common envelope formats
                    for key in ["customers", "data", "items", "results", "records"]:
                         if key in raw and isinstance(raw[key], list):
                             print(f"[GenericRESTAdapter] Successfully fetched {len(raw[key])} customers (envelope '{key}' format).")
                             return raw[key]
            except Exception as e:
                print(f"[GenericRESTAdapter] Fetch failed for path {path}. Error: {e}")
                continue

        return []

    async def _fetch_evershop_graphql(self):
        """Query EverShop GraphQL API for customer list."""
        query = json.dumps({
            "query": """{ 
                customers(filters: []) { 
                    items { 
                        customer_id 
                        email 
                        full_name 
                        status 
                        group { 
                            customer_group_name 
                        } 
                    } 
                    total 
                } 
            }"""
        }).encode()

        for path in ["/admin/graphql", "/graphql"]:
            try:
                url = f"{self.base_url}{path}"
                print(f"[GenericRESTAdapter] Querying GraphQL endpoint: {url} with API Key prefix: '{self.api_key[:6] if self.api_key else 'None'}...'")
                req = urllib.request.Request(
                    url,
                    data=query,
                    method="POST"
                )
                for k, v in self._build_headers().items():
                    req.add_header(k, v)
                with urllib.request.urlopen(req, timeout=5) as response:
                    raw = json.loads(response.read().decode())
                    items = (raw.get("data") or {}).get("customers", {}).get("items", [])
                    print(f"[GenericRESTAdapter] Successfully fetched {len(items)} GraphQL items.")
                    return items
            except Exception as e:
                print(f"[GenericRESTAdapter] GraphQL fetch failed for path {path}. Error: {e}")
                continue
        return None

    async def fetch_orders(self) -> list:
        return []

    async def fetch_products(self) -> list:
        return []

    async def fetch_addresses(self) -> list:
        return []

    async def fetch_users(self) -> list:
        return []

    async def fetch_webhooks(self) -> list:
        return []

    async def register_webhook(self) -> bool:
        return True
