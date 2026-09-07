from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime

class IntegrationConnectRequest(BaseModel):
    store_name: str
    store_url: str
    platform: str
    api_key: str
    secret: Optional[str] = None

class IntegrationConfigResponse(BaseModel):
    id: int
    store_name: Optional[str]
    store_url: Optional[str]
    platform: Optional[str]
    connection_status: str
    api_version: Optional[str]
    webhook_url: Optional[str]
    last_sync: Optional[datetime]

    class Config:
        from_attributes = True

class SyncHistoryResponse(BaseModel):
    id: int
    event: Optional[str]
    status: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True
