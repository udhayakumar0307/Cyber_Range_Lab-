from abc import ABC, abstractmethod

class BaseAdapter(ABC):
    @abstractmethod
    async def verify_connection(self) -> bool:
        pass

    @abstractmethod
    async def fetch_customers(self) -> list:
        pass

    @abstractmethod
    async def fetch_orders(self) -> list:
        pass

    @abstractmethod
    async def fetch_products(self) -> list:
        pass

    @abstractmethod
    async def fetch_addresses(self) -> list:
        pass

    @abstractmethod
    async def fetch_users(self) -> list:
        pass

    @abstractmethod
    async def fetch_webhooks(self) -> list:
        pass

    @abstractmethod
    async def register_webhook(self) -> bool:
        pass
