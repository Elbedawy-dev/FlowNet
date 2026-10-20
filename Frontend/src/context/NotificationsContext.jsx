import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { notificationsApi } from '../api/axios';
import { useSocketEvent } from './SocketContext';
import toast from 'react-hot-toast';

const NotificationsContext = createContext({
  unreadCount: 0,
  setUnreadCount: () => {},
  refreshUnreadCount: async () => {},
  markAllAsRead: async () => {},
});

export const NotificationsProvider = ({ children }) => {
  const { isSignedIn } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!isSignedIn) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res?.unread_count || 0);
    } catch (err) {
      console.warn('[Notifications] Failed to load unread count:', err.message);
    }
  }, [isSignedIn]);

  useEffect(() => {
    fetchUnreadCount();

    const handleFocus = () => {
      fetchUnreadCount();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchUnreadCount]);

  const seenNotificationIdsRef = useRef(new Set());

  // Listen to realtime notification events via Ably channel subscription
  const handleNewNotification = useCallback((notification) => {
    if (!notification?._id) return;
    if (seenNotificationIdsRef.current.has(notification._id)) return;
    seenNotificationIdsRef.current.add(notification._id);

    setUnreadCount((prev) => prev + 1);

    const actorName = notification.actor?.full_name || 'Someone';
    let actionText = 'sent you a notification';
    switch (notification.type) {
      case 'like':
        actionText = 'liked your post ❤️';
        break;
      case 'comment':
        actionText = 'commented on your post 💬';
        break;
      case 'follow':
        actionText = 'started following you 👤';
        break;
      case 'connection_request':
        actionText = 'sent you a connection request 🤝';
        break;
      case 'connection_accepted':
        actionText = 'accepted your connection request ✨';
        break;
      case 'group_join_request':
        actionText = 'requested to join your group 👥';
        break;
      case 'group_request_accepted':
        actionText = 'accepted your group join request 🚀';
        break;
      default:
        break;
    }

    toast(`${actorName} ${actionText}`, {
      icon: '🔔',
      style: {
        background: '#1a1f4d',
        color: '#ffffff',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        borderRadius: '16px',
      },
    });
  }, []);

  useSocketEvent('notification:new', handleNewNotification);

  useSocketEvent(
    'notification:count',
    useCallback((data) => {
      const val = typeof data?.count === 'number'
        ? data.count
        : typeof data?.unread === 'number'
        ? data.unread
        : null;
      if (val !== null) {
        setUnreadCount(val);
      }
    }, [])
  );

  useSocketEvent(
    'notification:deleted',
    useCallback((data) => {
      const ids = Array.isArray(data?.ids) ? data.ids : data?.id ? [data.id] : [];
      for (const id of ids) {
        seenNotificationIdsRef.current.delete(id);
      }
    }, [])
  );

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
    } catch (err) {
      console.warn('[Notifications] Failed to mark all as read:', err.message);
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        unreadCount,
        setUnreadCount,
        refreshUnreadCount: fetchUnreadCount,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
export default NotificationsContext;
