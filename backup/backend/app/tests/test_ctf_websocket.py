import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure backend root is on sys.path
sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
)

from app.ws.ctf_ws import CTFConnectionManager


class TestCTFConnectionManager(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.manager = CTFConnectionManager()
        self.mock_ws1 = AsyncMock()
        self.mock_ws2 = AsyncMock()

    async def test_connect(self):
        await self.manager.connect(1, self.mock_ws1)
        self.mock_ws1.accept.assert_called_once()
        self.assertIn(1, self.manager.active_connections)
        self.assertIn(self.mock_ws1, self.manager.active_connections[1])

    async def test_disconnect(self):
        await self.manager.connect(1, self.mock_ws1)
        await self.manager.connect(1, self.mock_ws2)
        
        self.manager.disconnect(1, self.mock_ws1)
        self.assertNotIn(self.mock_ws1, self.manager.active_connections[1])
        self.assertIn(self.mock_ws2, self.manager.active_connections[1])

        self.manager.disconnect(1, self.mock_ws2)
        self.assertNotIn(1, self.manager.active_connections)

    async def test_broadcast_success(self):
        await self.manager.connect(1, self.mock_ws1)
        await self.manager.connect(1, self.mock_ws2)

        payload = {"hello": "world"}
        await self.manager.broadcast(1, payload)

        self.mock_ws1.send_json.assert_called_once_with(payload)
        self.mock_ws2.send_json.assert_called_once_with(payload)

    async def test_broadcast_graceful_disconnect_on_send_error(self):
        await self.manager.connect(1, self.mock_ws1)
        await self.manager.connect(1, self.mock_ws2)

        # Force send_json on ws1 to throw an error
        self.mock_ws1.send_json.side_effect = Exception("Connection closed")

        payload = {"hello": "world"}
        await self.manager.broadcast(1, payload)

        # ws1 should be disconnected/removed from the manager due to send error
        self.assertNotIn(self.mock_ws1, self.manager.active_connections.get(1, set()))
        # ws2 should still receive the payload and remain connected
        self.mock_ws2.send_json.assert_called_once_with(payload)
        self.assertIn(self.mock_ws2, self.manager.active_connections[1])


if __name__ == "__main__":
    unittest.main()
