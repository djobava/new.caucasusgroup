import { useConnection } from '../context/ConnectionContext';
import { useEffect, useState } from 'react';
import './ConnectionStatus.css';

export default function ConnectionStatus() {
  const { isConnected, isOnline, connectionStatus, isOffline } = useConnection();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setShowNotification(true);
    }
  }, [isOffline]);

  if (!isOffline || !showNotification) {
    return null;
  }

  const getStatusMessage = () => {
    if (!isOnline) {
      return 'No Internet Connection';
    }
    if (!isConnected) {
      return 'Backend Connection Lost';
    }
    if (connectionStatus === 'connecting') {
      return 'Reconnecting...';
    }
    return 'Connection Error';
  };

  const getStatusIcon = () => {
    if (connectionStatus === 'connecting') {
      return '🔄';
    }
    return '⚠️';
  };

  return (
    <>
      {/* Banner at top of page */}
      <div className={`connection-status-banner ${connectionStatus}`}>
        <div className="connection-status-content">
          <span className="connection-status-icon">{getStatusIcon()}</span>
          <div className="connection-status-text">
            <p className="connection-status-title">{getStatusMessage()}</p>
            <p className="connection-status-detail">
              {!isOnline
                ? 'Check your internet connection'
                : 'Trying to reconnect to the server...'}
            </p>
          </div>
        </div>
        <button
          className="connection-status-close"
          onClick={() => setShowNotification(false)}
        >
          ✕
        </button>
      </div>

      {/* Floating indicator */}
      <div className={`connection-indicator ${connectionStatus}`} title={getStatusMessage()}>
        <span className="indicator-dot"></span>
        <span className="indicator-text">
          {connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
        </span>
      </div>
    </>
  );
}
