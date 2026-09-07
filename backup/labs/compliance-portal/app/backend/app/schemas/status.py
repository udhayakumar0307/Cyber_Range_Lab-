from pydantic import BaseModel
from typing import Optional

class EngineStatus(BaseModel):
    status: str             # NOT_CONNECTED, CONNECTING, SYNCING, ANALYZING, READY, WARNING, ERROR
    current_task: str
    progress: int
    last_scan: str
    next_scan: str
    scheduler_running: bool
    cache_version: str
    analysis_version: str
