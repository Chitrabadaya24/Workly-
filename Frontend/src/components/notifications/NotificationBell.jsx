import { useState, useEffect, useRef } from 'react';
import { notificationAPI } from '../../services/apiService';
import { getSocket } from '../../socket/socket';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const loadNotifications = async () => {
    try {
      const { data } = await notificationAPI.getAll({ limit: 10 });
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    } catch {}
  };

  useEffect(() => {
    loadNotifications();

    const socket = getSocket();
    if (socket) {
      socket.on('new_notification', (notification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 10));
        setUnread(prev => prev + 1);
      });
    }

    return () => {
      const s = getSocket();
      if (s) s.off('new_notification');
    };
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllRead();
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative btn-ghost p-2 rounded-xl"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse-dot">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 dark:border-surface-800">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white text-sm">
              Notifications {unread > 0 && <span className="text-primary-600">({unread})</span>}
            </h3>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-surface-400 text-sm">
                <div className="text-3xl mb-2">🔔</div>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`px-4 py-3 border-b border-surface-50 dark:border-surface-800 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer ${!n.isRead ? 'bg-primary-50/50 dark:bg-primary-950/20' : ''}`}
                  onClick={async () => {
                    if (!n.isRead) {
                      await notificationAPI.markRead(n._id);
                      setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, isRead: true } : x));
                      setUnread(prev => Math.max(0, prev - 1));
                    }
                  }}
                >
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{n.title}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
