import { useEffect, useRef, useState, useCallback } from 'react';

export interface WSMessage {
  type: 'score_update' | 'ctf_started' | 'ctf_ended';
  leaderboard?: any;
}

export const useCTFWebSocket = (ctfId: number, onMessage?: (msg: WSMessage) => void) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    
    // Construct WebSocket URL
    const url = `${protocol}://${host}/api/v1/ctf/ws?ctf_id=${ctfId}${token ? `&token=${token}` : ''}`;
    
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log(`[WebSocket] Connected to CTF ${ctfId} room.`);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const payload: WSMessage = JSON.parse(event.data);
        if (onMessage) {
          onMessage(payload);
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      wsRef.current = null;
      console.log(`[WebSocket] Connection closed for CTF ${ctfId}. Reconnecting in 5s...`, event.reason);
      
      // Auto-reconnect
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 5000);
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Error in CTF WebSocket:', err);
      ws.close();
    };

  }, [ctfId, onMessage]);

  useEffect(() => {
    connect();

    // Ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Prevent reconnect loop on unmount
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected };
};
