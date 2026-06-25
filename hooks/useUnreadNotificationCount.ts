'use client';

import { useCallback, useEffect, useState } from 'react';

export const NOTIFICATIONS_CHANGED_EVENT = 'mubs:notifications-changed';

export function dispatchNotificationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function useUnreadNotificationCount(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { unreadCount?: number };
      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch {
      // ignore
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;

    const onChange = () => void refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
    const interval = window.setInterval(() => void refresh(), 45000);

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
      window.clearInterval(interval);
    };
  }, [enabled, refresh]);

  return { unreadCount, refresh };
}
