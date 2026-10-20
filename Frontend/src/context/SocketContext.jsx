import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Realtime } from 'ably';
import { useAuth, useUser } from '@clerk/clerk-react';
import api from '../api/axios';
import { useCurrentUser } from './CurrentUserContext';

const SocketContext = createContext({
  ably: null,
  connected: false,
  socket: null,
  isConnected: false,
});

const USER_EVENTS = new Set([
  'message:new',
  'message:seen',
  'message:deleted',
  'conversation:deleted',
  'notification:new',
  'notification:count',
  'notification:deleted',
  'group:request',
  'group:request_accepted',
]);

const FEED_EVENTS = new Set([
  'post:stats',
  'post:deleted',
  'story:new',
  'story:deleted',
]);

export const shouldDebug = () => {
  if (typeof window !== 'undefined' && window.__flownetDebug) return true;
  return Boolean(import.meta.env.DEV);
};

export const SocketProvider = ({ children }) => {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { currentUser } = useCurrentUser();
  const [ably, setAbly] = useState(null);
  const [connected, setConnected] = useState(false);
  const ablyRef = useRef(null);
  const activeSubscriptionsRef = useRef(new Map());

  // Strictly prioritize loaded currentUser._id, falling back to Clerk user.id
  const currentUserId = currentUser?._id || user?.id || null;
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Initialize ONE Ably.Realtime instance after Clerk sign-in
  useEffect(() => {
    const isMock = Boolean(
      import.meta.env.DEV &&
      typeof window !== 'undefined' &&
      localStorage.getItem('test_mock_user') === 'true'
    );

    if (!isSignedIn && !isMock) {
      if (ablyRef.current) {
        if (shouldDebug()) {
          console.log('[Ably] Closing connection on sign-out');
        }
        ablyRef.current.close();
        ablyRef.current = null;
        setAbly(null);
        setConnected(false);
      }
      return;
    }

    let isMounted = true;

    try {
      const client = new Realtime({
        authCallback: async (tokenParams, callback) => {
          try {
            const clerkToken = await getToken();
            const headers = clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {};
            const res = await api.get('/realtime/token', {
              headers,
              params: tokenParams,
            });

            const tokenRequest = res?.data !== undefined ? res.data : res;

            if (typeof callback === 'function') {
              callback(null, tokenRequest);
            }
            return tokenRequest;
          } catch (err) {
            console.error('[Ably] Token request failed:', err.message);
            if (typeof callback === 'function') {
              callback(err, null);
            }
            throw err;
          }
        },
        autoConnect: true,
      });

      // Console log for connection state changes (DEV or window.__flownetDebug)
      client.connection.on((stateChange) => {
        if (shouldDebug()) {
          console.log(
            `[Ably] Connection state changed: ${stateChange.previous} -> ${stateChange.current}`
          );
        }
        if (stateChange.reason) {
          console.error('[Ably] Connection state change reason/error:', stateChange.reason);
        }
        if (isMounted) {
          setConnected(stateChange.current === 'connected');
        }
      });

      ablyRef.current = client;
      if (isMounted) {
        setAbly(client);
      }
    } catch (err) {
      console.error('[Ably] Setup error:', err);
    }

    return () => {
      isMounted = false;
      if (ablyRef.current) {
        ablyRef.current.close();
        ablyRef.current = null;
      }
    };
  }, [isSignedIn, getToken]);

  // Handle group:request_accepted capability refresh & refetch
  useEffect(() => {
    if (!ably || !connected || !currentUserId) return;

    const userChannel = ably.channels.get(`user:${currentUserId}`);

    const handleRequestAccepted = async (data) => {
      if (import.meta.env.DEV) {
        console.log('[Ably Dev] Received group:request_accepted event. Refreshing token capability...');
      }
      try {
        await ably.auth.authorize();
        window.dispatchEvent(
          new CustomEvent('flownet:refetch_data', { detail: { reason: 'group_accepted', data } })
        );
      } catch (err) {
        console.warn('[Ably] Error refreshing capability:', err.message);
      }
    };

    userChannel.subscribe('group:request_accepted', handleRequestAccepted);

    return () => {
      userChannel.unsubscribe('group:request_accepted', handleRequestAccepted);
    };
  }, [ably, connected, currentUserId]);

  // Backwards compatibility socket object for legacy components
  const legacySocket = useMemo(
    () => ({
      on: (event, handler) => {
        if (!ablyRef.current) return;
        const uid = currentUserIdRef.current;
        let channelName = 'feed';
        if (USER_EVENTS.has(event) || event.startsWith('user:')) {
          channelName = uid ? `user:${uid}` : 'feed';
        }
        const channel = ablyRef.current.channels.get(channelName);
        const listener = (msg) => {
          if (import.meta.env.DEV) {
            console.log(`[Ably Dev] [Legacy on] Channel "${channelName}" Event "${event}":`, msg.data);
          }
          handler(msg.data !== undefined ? msg.data : msg);
        };
        channel.subscribe(event, listener);
        activeSubscriptionsRef.current.set(`${channelName}:${event}:${handler}`, { channel, listener });
      },
      off: (event, handler) => {
        const uid = currentUserIdRef.current;
        let channelName = 'feed';
        if (USER_EVENTS.has(event) || event.startsWith('user:')) {
          channelName = uid ? `user:${uid}` : 'feed';
        }
        const key = `${channelName}:${event}:${handler}`;
        const entry = activeSubscriptionsRef.current.get(key);
        if (entry) {
          entry.channel.unsubscribe(event, entry.listener);
          activeSubscriptionsRef.current.delete(key);
        }
      },
      emit: (event, payload) => {
        // For room join/leave in legacy code, Ably uses channels.get(name)
        if (import.meta.env.DEV) {
          console.log(`[Ably Dev] [Legacy emit] Event "${event}":`, payload);
        }
      },
    }),
    []
  );

  return (
    <SocketContext.Provider
      value={{
        ably,
        connected,
        socket: legacySocket,
        isConnected: connected,
        userId: currentUserId,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

/**
 * useSocket hook
 * Returns { ably, connected, socket, isConnected }
 */
export const useSocket = () => useContext(SocketContext);

/**
 * useSocketEvent(event, handler)
 * Subscribes to events from:
 * - user events: channel `user:{me}`
 * - feed events: channel `feed`
 */
export const useSocketEvent = (event, handler) => {
  const { ably, connected, userId } = useSocket();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!ably || !connected || !event) return;

    let channelName = null;
    if (USER_EVENTS.has(event) || event.startsWith('user:')) {
      if (!userId) return;
      channelName = `user:${userId}`;
    } else if (FEED_EVENTS.has(event) || event.startsWith('feed')) {
      channelName = 'feed';
    } else {
      channelName = userId ? `user:${userId}` : 'feed';
    }

    const channel = ably.channels.get(channelName);

    const onAttached = () => {
      if (shouldDebug()) {
        console.log(`[Ably] Channel "${channelName}" attached successfully`);
      }
    };

    const onFailed = (stateChange) => {
      console.error(
        `[Ably] Channel "${channelName}" attach failed:`,
        stateChange?.reason || stateChange
      );
    };

    channel.on('attached', onAttached);
    channel.on('failed', onFailed);

    const listener = (msg) => {
      if (shouldDebug()) {
        console.log(`[Ably] Channel "${channelName}" Event "${event}":`, msg.data);
      }
      if (handlerRef.current) {
        handlerRef.current(msg.data !== undefined ? msg.data : msg);
      }
    };

    channel.subscribe(event, listener);

    return () => {
      channel.off('attached', onAttached);
      channel.off('failed', onFailed);
      channel.unsubscribe(event, listener);
    };
  }, [ably, connected, event, userId]);
};

/**
 * useRoom(type, id, handlers)
 * Subscribes/unsubscribes to room channels:
 * - `post:{id}`
 * - `group:{id}`
 * Always unsubscribes in cleanup.
 */
export const useRoom = (type, id, handlers = {}) => {
  const { ably, connected } = useSocket();
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const channelName = type && id ? `${type}:${id}` : null;

  useEffect(() => {
    if (!ably || !channelName || !connected) return;

    const channel = ably.channels.get(channelName);

    const onAttached = () => {
      if (shouldDebug()) {
        console.log(`[Ably] Room Channel "${channelName}" attached successfully`);
      }
    };

    const onFailed = (stateChange) => {
      console.error(
        `[Ably] Room Channel "${channelName}" attach failed:`,
        stateChange?.reason || stateChange
      );
    };

    channel.on('attached', onAttached);
    channel.on('failed', onFailed);

    const listeners = [];
    const currentHandlers = handlersRef.current || {};
    for (const [event, fn] of Object.entries(currentHandlers)) {
      if (typeof fn !== 'function') continue;

      const listener = (msg) => {
        if (shouldDebug()) {
          console.log(`[Ably] Room "${channelName}" Event "${event}":`, msg.data);
        }
        fn(msg.data !== undefined ? msg.data : msg);
      };

      channel.subscribe(event, listener);
      listeners.push({ event, listener });
    }

    return () => {
      channel.off('attached', onAttached);
      channel.off('failed', onFailed);
      for (const { event, listener } of listeners) {
        channel.unsubscribe(event, listener);
      }
    };
  }, [ably, channelName, connected]);

  const subscribe = useCallback(
    (event, fn) => {
      if (!ably || !channelName) return () => {};

      const channel = ably.channels.get(channelName);
      const listener = (msg) => {
        if (shouldDebug()) {
          console.log(`[Ably] Room "${channelName}" Event "${event}":`, msg.data);
        }
        fn(msg.data !== undefined ? msg.data : msg);
      };

      channel.subscribe(event, listener);

      return () => {
        channel.unsubscribe(event, listener);
      };
    },
    [ably, channelName]
  );

  const channel = ably && channelName ? ably.channels.get(channelName) : null;

  return { channel, subscribe, channelName };
};

export default SocketContext;
