import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { Notification, NotificationPriority } from '@home-management/types';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
  onAction?: (action: string) => void;
  autoClose?: boolean;
  duration?: number;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onAction,
  autoClose = true,
  duration = 5000,
}) => {
  const { t } = useTranslation('common');
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (autoClose && duration > 0) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 100));
          if (newProgress <= 0) {
            handleClose();
            return 0;
          }
          return newProgress;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [autoClose, duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation
  };

  const handleAction = (action: string) => {
    onAction?.(action);
    handleClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'reservation_confirmation':
      case 'reservation_update':
      case 'reservation_cancellation':
      case 'reservation_reminder':
        return '📅';
      case 'meeting_scheduled':
      case 'meeting_updated':
      case 'meeting_cancelled':
      case 'meeting_rescheduled':
      case 'meeting_notes_published':
        return '🏢';
      case 'vote_created':
      case 'vote_closed':
        return '🗳️';
      case 'agreement_activated':
        return '📋';
      case 'payment_due':
      case 'payment_overdue':
      case 'payment_confirmed':
        return '💰';
      case 'system_announcement':
        return '📢';
      default:
        return '🔔';
    }
  };

  const getColorClasses = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent':
        return {
          container: 'bg-red-50 border-red-200',
          icon: 'text-red-600',
          title: 'text-red-900',
          body: 'text-red-700',
          progress: 'bg-red-500',
        };
      case 'high':
        return {
          container: 'bg-orange-50 border-orange-200',
          icon: 'text-orange-600',
          title: 'text-orange-900',
          body: 'text-orange-700',
          progress: 'bg-orange-500',
        };
      case 'normal':
        return {
          container: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          body: 'text-blue-700',
          progress: 'bg-blue-500',
        };
      case 'low':
        return {
          container: 'bg-gray-50 border-gray-200',
          icon: 'text-gray-600',
          title: 'text-gray-900',
          body: 'text-gray-700',
          progress: 'bg-gray-500',
        };
      default:
        return {
          container: 'bg-white border-gray-200',
          icon: 'text-gray-600',
          title: 'text-gray-900',
          body: 'text-gray-700',
          progress: 'bg-blue-500',
        };
    }
  };

  const colors = getColorClasses(notification.priority);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed top-4 right-4 max-w-sm w-full bg-white rounded-lg shadow-lg border-2 z-50
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${colors.container}
      `}
    >
      {/* Progress bar */}
      {autoClose && duration > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 rounded-t-lg overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ease-linear ${colors.progress}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <span className={`text-2xl ${colors.icon}`}>
              {getIcon(notification.type)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h4 className={`text-sm font-medium ${colors.title} truncate`}>
                {notification.title}
              </h4>
              <button
                onClick={handleClose}
                className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">{t('common.close')}</span>
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <p className={`mt-1 text-sm ${colors.body}`}>
              {notification.body}
            </p>

            {/* Priority badge */}
            <div className="mt-2 flex items-center justify-between">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.container} ${colors.title}`}
              >
                {t(`notifications.priority.${notification.priority}`)}
              </span>

              {/* Channels */}
              <div className="flex space-x-1">
                {notification.channels.map((channel) => (
                  <span
                    key={channel}
                    className="text-xs text-gray-500"
                    title={t(`notifications.channels.${channel}`)}
                  >
                    {channel === 'push' && '📱'}
                    {channel === 'email' && '📧'}
                    {channel === 'sms' && '💬'}
                    {channel === 'in_app' && '🔔'}
                  </span>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {notification.data?.actions && (
              <div className="mt-3 flex space-x-2">
                {JSON.parse(notification.data.actions).map((action: any) => (
                  <button
                    key={action.action}
                    onClick={() => handleAction(action.action)}
                    className={`
                      inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md
                      ${colors.title} hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                    `}
                  >
                    {action.icon && <span className="mr-1">{action.icon}</span>}
                    {action.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Toast container component
interface NotificationToastContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
  onAction?: (id: string, action: string) => void;
  maxToasts?: number;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  notifications,
  onClose,
  onAction,
  maxToasts = 3,
}) => {
  // Show only the most recent notifications
  const visibleNotifications = notifications.slice(-maxToasts);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {visibleNotifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            transform: `translateY(${index * 10}px)`,
            zIndex: 50 - index,
          }}
        >
          <NotificationToast
            notification={notification}
            onClose={() => onClose(notification.id)}
            onAction={(action) => onAction?.(notification.id, action)}
          />
        </div>
      ))}
    </div>
  );
};