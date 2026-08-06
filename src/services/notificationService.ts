/**
 * notificationService.ts
 * ====================
 * Real-time notification service & WebSocket listener for frontend components.
 */

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action_url?: string;
  status: string;
  read: boolean;
  read_at?: string;
  created_at: string;
  email_sent?: boolean;
  sms_sent?: boolean;
  meta_data?: Record<string, any>;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  phone_number?: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export async function fetchNotifications(params?: {
  unread_only?: boolean;
  category?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: NotificationItem[]; total: number; unread_count: number }> {
  const query = new URLSearchParams();
  if (params?.unread_only) query.append('unread_only', 'true');
  if (params?.category) query.append('category', params.category);
  if (params?.priority) query.append('priority', params.priority);
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', params.page.toString());
  if (params?.limit) query.append('limit', params.limit.toString());

  const res = await fetch(`/api/v1/notifications?${query.toString()}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    return { items: [], total: 0, unread_count: 0 };
  }
  return res.json();
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch('/api/v1/notifications/count', { headers: getAuthHeaders() });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.unread_count || 0;
}

export async function markNotificationAsRead(id: number): Promise<boolean> {
  const res = await fetch(`/api/v1/notifications/${id}/read`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.ok;
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
  const res = await fetch('/api/v1/notifications/read-all', {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.ok;
}

export async function clearAllNotifications(): Promise<boolean> {
  const res = await fetch('/api/v1/notifications/clear', {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return res.ok;
}

export async function deleteNotification(id: number): Promise<boolean> {
  const res = await fetch(`/api/v1/notifications/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return res.ok;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences | null> {
  const res = await fetch('/api/v1/notifications/preferences', { headers: getAuthHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function updateNotificationPreferences(prefs: NotificationPreferences): Promise<boolean> {
  const res = await fetch('/api/v1/notifications/preferences', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(prefs)
  });
  return res.ok;
}

// ── WebSocket Connection Setup ──────────────────────────────────────────────
export function setupNotificationWebSocket(onNewNotification: (notification: NotificationItem) => void): () => void {
  const token = localStorage.getItem('token');
  if (!token) return () => {};

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/v1/notifications/ws?token=${encodeURIComponent(token)}`;

  let ws: WebSocket | null = null;
  let pingInterval: any = null;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'NEW_NOTIFICATION' && payload.notification) {
          onNewNotification(payload.notification);
        }
      } catch (e) {
        // Ignored string messages like 'pong'
      }
    };
  } catch (err) {
    console.warn('WebSocket connection fallback to polling:', err);
  }

  return () => {
    if (pingInterval) clearInterval(pingInterval);
    if (ws) ws.close();
  };
}
