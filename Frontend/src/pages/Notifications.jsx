import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Heart, MessageCircle, Image as ImageIcon, Sparkles } from 'lucide-react';
import moment from 'moment';
import { notificationsApi } from '../api/axios';
import { useNotifications } from '../context/NotificationsContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import { NotificationSkeleton } from '../components/Skeletons';
import useInfiniteScroll from '../hooks/useInfiniteScroll';

const Notifications = () => {
  const navigate = useNavigate();
  const { markAllAsRead, refreshUnreadCount } = useNotifications();
  const { socket } = useSocket();
  const { t, lang } = useLanguage();

  const [filter, setFilter] = useState('all'); // 'all' | 'likes' | 'comments' | 'media'
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Mark all notifications as read on page load
  useEffect(() => {
    markAllAsRead();
    refreshUnreadCount();
  }, [markAllAsRead, refreshUnreadCount]);

  // Initial fetch when filter changes
  const fetchNotifications = useCallback(
    async (cursor = null, isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        const res = await notificationsApi.getAll(filter, cursor, 20);
        const items = res?.items || res || [];
        const meta = res?.meta || {};

        setNotifications((prev) => (cursor ? [...prev, ...items] : items));
        setNextCursor(meta.next_cursor || null);
        setHasMore(Boolean(meta.has_more));
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    setNotifications([]);
    setNextCursor(null);
    setHasMore(true);
    fetchNotifications(null, true);
  }, [filter, fetchNotifications]);

  // Real-time notification updates
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotif) => {
      let matches = false;
      if (filter === 'all') matches = true;
      else if (filter === 'likes' && newNotif.type === 'like') matches = true;
      else if (filter === 'comments' && newNotif.type === 'comment') matches = true;
      else if (
        filter === 'media' &&
        newNotif.post?.image_urls &&
        newNotif.post.image_urls.length > 0
      )
        matches = true;

      if (matches) {
        setNotifications((prev) => [newNotif, ...prev]);
      }
    };

    socket.on('notification:new', handleNewNotification);
    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, filter]);

  // Infinite scroll hook
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && nextCursor) {
      fetchNotifications(nextCursor, false);
    }
  }, [hasMore, loadingMore, nextCursor, fetchNotifications]);

  const sentinelRef = useInfiniteScroll(handleLoadMore, {
    disabled: !hasMore || loadingMore || loading,
  });

  const getActionText = (n) => {
    switch (n.type) {
      case 'like':
        return t('notifications.likedPost') || 'liked your post';
      case 'comment':
        return t('notifications.commentedPost') || 'commented on your post';
      case 'follow':
        return t('notifications.startedFollowing') || 'started following you';
      case 'connection_request':
        return t('notifications.sentConnection') || 'sent you a connection request';
      case 'connection_accepted':
        return t('notifications.acceptedConnection') || 'accepted your connection request';
      case 'group_join_request':
        return t('notifications.groupJoinRequest') || 'requested to join your group';
      case 'group_request_accepted':
        return t('notifications.groupRequestAccepted') || 'accepted your group join request';
      case 'message':
        return t('notifications.sentMessage') || 'sent you a message';
      default:
        return t('notifications.interacted') || 'interacted with you';
    }
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />;
      case 'comment':
        return <MessageCircle className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />;
      case 'follow':
      case 'connection_request':
      case 'connection_accepted':
        return <Sparkles className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-yellow-400" />;
    }
  };

  const handleRowClick = (n) => {
    if (n.post?._id || n.post) {
      const postId = n.post?._id || n.post;
      navigate(`/post/${postId}`);
    } else if (n.actor?._id) {
      navigate(`/profile/${n.actor._id}`);
    } else if (n.type?.startsWith('group')) {
      navigate('/groups/joined');
    }
  };

  const tabs = [
    { key: 'all', label: t('notifications.all') || 'All', icon: Bell },
    { key: 'likes', label: t('notifications.likes') || 'Likes', icon: Heart },
    { key: 'comments', label: t('notifications.comments') || 'Comments', icon: MessageCircle },
    { key: 'media', label: t('notifications.media') || 'Media', icon: ImageIcon },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-linear-to-tr from-pink-500/20 via-purple-500/20 to-indigo-500/20 border border-purple-500/30 mb-3 shadow-md">
          <Bell className="w-7 h-7 text-pink-600 dark:text-pink-400 animate-pulse" />
        </div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-700 via-fuchsia-600 to-pink-600 dark:from-pink-400 dark:via-purple-300 dark:to-indigo-300">
          {t('notifications.title') || 'Notifications'}
        </h1>
        <p className="text-app-muted text-sm mt-1">
          {t('notifications.subtitle') || 'Stay updated with your cosmic interactions and network activities'}
        </p>

        {/* Filter Tabs (Centered, Icon-Only) */}
        <div className="flex items-center justify-center gap-3 mt-6 p-1.5 bg-app-card backdrop-blur border border-app rounded-2xl shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                title={tab.label}
                aria-label={tab.label}
                className={`relative p-3 rounded-xl transition-all duration-300 flex items-center justify-center ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105'
                    : 'text-app-muted hover:text-app hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title={t('notifications.emptyTitle') || "No notifications yet"}
            message={
              filter === 'all'
                ? (t('notifications.emptyDesc') || "When someone likes, comments, or connects with you, you'll see it here.")
                : (t('notifications.emptyDesc') || "No notifications found under this filter.")
            }
            icon={Bell}
          />
        ) : (
          <>
            {notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => handleRowClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRowClick(n);
                }}
                className={`group relative flex items-start gap-4 p-4 rounded-2xl transition-all duration-200 cursor-pointer border ${
                  !n.read
                    ? 'bg-app-card border-purple-500/40 shadow-[0_0_20px_rgba(147,51,234,0.15)] ring-1 ring-purple-500/20'
                    : 'bg-app-card/80 hover:bg-app-card border-app hover:border-purple-500/30'
                } hover:scale-[1.01]`}
              >
                {/* Left: Avatar with type badge */}
                <div className="relative shrink-0">
                  <Avatar
                    src={n.actor?.profile_picture}
                    name={n.actor?.full_name || 'User'}
                    size="md"
                    className="ring-2 ring-purple-500/30 group-hover:ring-purple-400 transition"
                  />
                  <div className="absolute -bottom-1 -end-1 p-1 rounded-full bg-app-card border border-app shadow-sm">
                    {getActionIcon(n.type)}
                  </div>
                </div>

                {/* Center: Details */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-app-muted">
                    <span className="font-bold text-app hover:text-pink-400 transition me-1.5">
                      {n.actor?.full_name || 'Someone'}
                    </span>
                    <span className="text-app-muted">{getActionText(n)}</span>
                  </div>

                  {/* Comment Inset Box if present */}
                  {n.comment_text && (
                    <div className="mt-2 p-2.5 bg-app-input border border-app rounded-xl text-xs text-app italic line-clamp-2">
                      &ldquo;{n.comment_text}&rdquo;
                    </div>
                  )}

                  {/* Time ago */}
                  <div className="text-xs text-app-muted mt-1.5 flex items-center gap-1.5">
                    <span>{moment(n.createdAt).locale(lang).fromNow()}</span>
                    {!n.read && (
                      <>
                        <span>•</span>
                        <span className="text-pink-400 font-medium">{t('notifications.newBadge') || 'New'}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Media thumbnail if post has images */}
                {n.post?.image_urls && n.post.image_urls.length > 0 && (
                  <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-app bg-black/40">
                    <img
                      src={n.post.image_urls[0]}
                      alt="Post preview"
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-6 flex items-center justify-center">
              {loadingMore && (
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Notifications;
