import { useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/apiService';
import { getSocket } from '../socket/socket';

/**
 * Hook to manage notification state and listen for real-time updates.
 * Usage: const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
 */
const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await notificationAPI.getAll({ limit: 20 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    if (socket) {
      socket.on('new_notification', (n) => {
        setNotifications((prev) => [n, ...prev].slice(0, 20));
        setUnreadCount((c) => c + 1);
      });
      return () => socket.off('new_notification');
    }
  }, [load]);

  const markRead = async (id) => {
    await notificationAPI.markRead(id);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await notificationAPI.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, loading, markRead, markAllRead, reload: load };
};

export default useNotifications;
