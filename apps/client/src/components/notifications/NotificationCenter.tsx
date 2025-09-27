import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { 
  Notification, 
  NotificationQueryDto, 
  NotificationStatsDto 
} from '@home-management/types';
import { useAuth } from '../../contexts/AuthContext';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [stats, setStats] = useState<NotificationStatsDto | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
      fetchStats();
    }
  }, [isOpen, user, filter]);

  const fetchNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const query: NotificationQueryDto = {
        userId: user.uid,
        unreadOnly: filter === 'unread',
      };

      const response = await fetch('/api/notifications?' + new URLSearchParams(query as any), {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/stats', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch notification stats:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId
              ? { ...notif, readAt: new Date() }
              : notif
          )
        );
        fetchStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, readAt: new Date() }))
        );
        fetchStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.filter(notif => notif.id !== notificationId)
        );
        fetchStats(); // Refresh stats
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'normal':
        return 'text-blue-600 bg-blue-50';
      case 'low':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return t('notifications.justNow');
    } else if (diffInHours < 24) {
      return t('notifications.hoursAgo', { hours: Math.floor(diffInHours) });
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('notifications.title')}
              </h2>
              <button
                onClick={onClose}
                className="rounded-md p-2 text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">{t('common.close')}</span>
                ✕
              </button>
            </div>

            {/* Stats */}
            {stats && (
              <div className="mt-2 text-sm text-gray-600">
                {t('notifications.stats', {
                  total: stats.totalSent,
                  unread: notifications.filter(n => !n.readAt).length,
                })}
              </div>
            )}

            {/* Filter and Actions */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-md text-sm ${
                    filter === 'all'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t('notifications.all')}
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 rounded-md text-sm ${
                    filter === 'unread'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t('notifications.unread')}
                </button>
              </div>

              {notifications.some(n => !n.readAt) && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🔔</div>
                <p>{t('notifications.empty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 ${
                      !notification.readAt ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">
                          {getNotificationIcon(notification.type)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {notification.title}
                          </p>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                                notification.priority
                              )}`}
                            >
                              {t(`notifications.priority.${notification.priority}`)}
                            </span>
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <p className="mt-1 text-sm text-gray-600">
                          {notification.body}
                        </p>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {formatDate(new Date(notification.createdAt))}
                          </span>

                          {!notification.readAt && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {t('notifications.markRead')}
                            </button>
                          )}
                        </div>

                        {/* Channels */}
                        <div className="mt-2 flex space-x-1">
                          {notification.channels.map((channel) => (
                            <span
                              key={channel}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-600"
                            >
                              {channel === 'push' && '📱'}
                              {channel === 'email' && '📧'}
                              {channel === 'sms' && '💬'}
                              {channel === 'in_app' && '🔔'}
                              {t(`notifications.channels.${channel}`)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};