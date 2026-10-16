import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-react';

const SocketContext = createContext({
  socket: null,
  isConnected: false,
});

export const SocketProvider = ({ children }) => {
  const { isSignedIn, getToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isSignedIn) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    let isMounted = true;

    const connectSocket = async () => {
      try {
        const token = await getToken();
        if (!isMounted || !token) return;

        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

        const s = io(socketUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });

        s.on('connect', () => {
          if (!isMounted) return;
          console.log('[Socket] Connected to server, socketId:', s.id);
          setIsConnected(true);
        });

        s.on('disconnect', (reason) => {
          if (!isMounted) return;
          console.log('[Socket] Disconnected:', reason);
          setIsConnected(false);
        });

        s.on('connect_error', (err) => {
          console.warn('[Socket] Connection error:', err.message);
        });

        socketRef.current = s;
        setSocket(s);
      } catch (err) {
        console.warn('[Socket] Setup error:', err);
      }
    };

    connectSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isSignedIn, getToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
