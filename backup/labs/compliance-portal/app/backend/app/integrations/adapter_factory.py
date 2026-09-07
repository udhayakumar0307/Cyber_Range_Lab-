from app.integrations.adapters.generic_rest_adapter import GenericRESTAdapter

class AdapterFactory:
    @staticmethod
    def get_adapter(platform_type: str, base_url: str, api_key: str = None):
        # Dynamically matches and resolves the platform integration adapter
        return GenericRESTAdapter(base_url=base_url, api_key=api_key, platform=platform_type)

adapter_factory = AdapterFactory()
