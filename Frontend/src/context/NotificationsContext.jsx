import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { notificationsApi } from '../api/axios';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

const NotificationsContext = createContext({
  unreadCount: 0,
  setUnreadCount: () => {},
  refreshUnreadCount: async () => {},
  markAllAsRead: async () => {},
});

export const NotificationsProvider = ({ children }) => {
  const { isSignedIn } = useAuth();
  const { socket } = useSocket();
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

  // Listen to realtime notification events
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
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
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

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
