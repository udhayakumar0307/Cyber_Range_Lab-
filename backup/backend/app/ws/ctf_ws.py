import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class CTFConnectionManager:
    """Manages active WebSocket connections mapped to ctf_ids."""

    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, ctf_id: int, websocket: WebSocket):
        await websocket.accept()
        if ctf_id not in self.active_connections:
            self.active_connections[ctf_id] = set()
        self.active_connections[ctf_id].add(websocket)
        logger.info(f"[WebSocket] CTF socket connected for ctf_id={ctf_id}")

    def disconnect(self, ctf_id: int, websocket: WebSocket):
        if ctf_id in self.active_connections:
            self.active_connections[ctf_id].discard(websocket)
            if not self.active_connections[ctf_id]:
                del self.active_connections[ctf_id]
        logger.info(f"[WebSocket] CTF socket disconnected for ctf_id={ctf_id}")

    async def broadcast(self, ctf_id: int, payload: Dict[str, Any]):
        if ctf_id in self.active_connections:
            dead_sockets = set()
            for ws in self.active_connections[ctf_id]:
                try:
                    await ws.send_json(payload)
                except Exception as exc:
                    logger.warning(f"[WebSocket] Error pushing to ctf {ctf_id}: {exc}")
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.disconnect(ctf_id, ws)

ctf_ws_manager = CTFConnectionManager()
