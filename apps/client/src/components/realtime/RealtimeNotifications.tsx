import React, { useState, useEffect } from 'react';
import { useRealtime, RealtimeNotification } from '../../contexts/RealtimeContext';

interface RealtimeNotificationsProps {
  className?: string;
  maxVisible?: number;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const RealtimeNotifications: React.FC<RealtimeNotificationsProps> = ({
  className = '',
  maxVisible = 5,
  autoHide = true,
  autoHideDelay = 5000
}) => {
  const { 
    notifications, 
    unreadCount, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    clearNotifications 
  } = useRealtime();
  
  const [visibleNotifications, setVisibleNotifications] = useState<RealtimeNotification[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update visible notifications
  useEffect(() => {
    const recent = notifications.slice(0, maxVisible);
    setVisibleNotifications(recent);
  }, [notifications, maxVisible]);

  // Auto-hide notifications
  useEffect(() => {
    if (autoHide && visibleNotifications.length > 0) {
      const timeouts = visibleNotifications.map((notification, index) => {
        if (!notification.read) {
          return setTimeout(() => {
            markNotificationAsRead(notification.id);
          }, autoHideDelay + (index * 1000)); // Stagger the auto-hide
        }
        return null;
      });

      return () => {
        timeouts.forEach(timeout => {
          if (timeout) clearTimeout(timeout);
        });
      };
    }
  }, [visibleNotifications, autoHide, autoHideDelay, markNotificationAsRead]);

  const getNotificationIcon = (type: RealtimeNotification['type']) => {
    switch (type) {
      case 'payment':
        return '💳';
      case 'reservation':
        return '📅';
      case 'meeting':
        return '🏢';
      case 'system':
        return '⚙️';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: RealtimeNotification['type']) => {
    switch (type) {
      case 'payment':
        return 'border-l-green-500 bg-green-50';
      case 'reservation':
        return 'border-l-blue-500 bg-blue-50';
      case 'meeting':
        return 'border-l-purple-500 bg-purple-50';
      case 'system':
        return 'border-l-gray-500 bg-gray-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatTimestamp = (timestamp: Date | string | undefined) => {
    if (!timestamp) return '-';
    
    try {
      const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return '-';
      }
      
      const now = new Date();
      const diff = now.getTime() - dateObj.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    } catch (error) {
      console.warn('Invalid timestamp format:', timestamp);
      return '-';
    }
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      {/* Notification Badge */}
      {unreadCount > 0 && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm hover:bg-blue-700 transition-colors"
          >
            <span>📢</span>
            <span>{unreadCount} new</span>
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className={`space-y-2 transition-all duration-300 ${isExpanded ? 'max-h-96 overflow-y-auto' : 'max-h-0 overflow-hidden'}`}>
        {visibleNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              border-l-4 p-4 rounded-r-lg shadow-lg max-w-sm
              ${getNotificationColor(notification.type)}
              ${notification.read ? 'opacity-75' : 'opacity-100'}
              transform transition-all duration-300 hover:scale-105
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <span className="text-lg">
                  {getNotificationIcon(notification.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {notification.title}
                  </h4>
                  <p className="text-sm text-gray-700 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatTimestamp(notification.timestamp)}
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col space-y-1 ml-2">
                {!notification.read && (
                  <button
                    onClick={() => markNotificationAsRead(notification.id)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                    title="Mark as read"
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={() => {
                    // Remove this specific notification
                    setVisibleNotifications(prev => 
                      prev.filter(n => n.id !== notification.id)
                    );
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      {isExpanded && visibleNotifications.length > 0 && (
        <div className="mt-2 flex justify-end space-x-2">
          <button
            onClick={markAllNotificationsAsRead}
            className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-gray-700"
          >
            Mark all read
          </button>
          <button
            onClick={clearNotifications}
            className="text-xs bg-red-200 hover:bg-red-300 px-2 py-1 rounded text-red-700"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default RealtimeNotifications;