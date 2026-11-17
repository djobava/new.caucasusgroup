import { createContext, useContext, useState, useEffect } from 'react';
import socket from '../socket';

const ConnectionContext = createContext();
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
};

export const ConnectionProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected', 'connecting', 'disconnected', 'offline'
  const [lastConnectionTime, setLastConnectionTime] = useState(new Date());

  // Monitor Socket.IO connection
  useEffect(() => {
    const handleSocketConnect = () => {
      setIsConnected(true);
      setConnectionStatus(navigator.onLine ? 'connected' : 'offline');
      setLastConnectionTime(new Date());
      console.log('✅ Socket connected');
    };

    const handleSocketDisconnect = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.log('❌ Socket disconnected');
    };

    const handleSocketError = (error) => {
      console.error('🚨 Socket error:', error);
      setConnectionStatus('disconnected');
    };

    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('connect_error', handleSocketError);

    return () => {
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
      socket.off('connect_error', handleSocketError);
    };
  }, []);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isConnected) {
        setConnectionStatus('connected');
      }
      console.log('📡 Browser online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('offline');
      setIsConnected(false);
      console.log('📡 Browser offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected]);

  // Periodic health check
  useEffect(() => {
    const healthCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          if (!isConnected) {
            setIsConnected(true);
            setConnectionStatus('connected');
            setLastConnectionTime(new Date());
          }
        } else {
          setIsConnected(false);
          setConnectionStatus('disconnected');
        }
      } catch {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(healthCheckInterval);
  }, [isConnected]);

  const value = {
    isConnected,
    isOnline,
    connectionStatus,
    lastConnectionTime,
    isOffline: !isConnected || !isOnline,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};
