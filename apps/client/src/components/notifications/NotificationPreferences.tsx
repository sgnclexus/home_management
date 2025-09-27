import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { 
  NotificationPreferences as NotificationPreferencesType,
  UpdateNotificationPreferencesDto,
  NotificationType,
  DeliveryChannel,
  NotificationPriority
} from '@home-management/types';
import { useAuth } from '../../contexts/AuthContext';

interface NotificationPreferencesProps {
  onSave?: (preferences: NotificationPreferencesType) => void;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  onSave,
}) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferencesType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: UpdateNotificationPreferencesDto) => {
    if (!user) return;

    setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedPreferences = await response.json();
        setPreferences(updatedPreferences);
        onSave?.(updatedPreferences);
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const response = await fetch('/api/notifications/preferences/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
      });

      if (response.ok) {
        const defaultPreferences = await response.json();
        setPreferences(defaultPreferences);
        onSave?.(defaultPreferences);
      }
    } catch (error) {
      console.error('Failed to reset preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleGlobalChannel = (channel: keyof Pick<NotificationPreferencesType, 'enablePush' | 'enableEmail' | 'enableSms' | 'enableInApp'>) => {
    if (!preferences) return;

    const updates: UpdateNotificationPreferencesDto = {
      [channel]: !preferences[channel],
    };

    updatePreferences(updates);
  };

  const toggleNotificationType = (type: NotificationType, enabled: boolean) => {
    if (!preferences) return;

    const updates: UpdateNotificationPreferencesDto = {
      typePreferences: {
        [type]: {
          ...preferences.typePreferences[type],
          enabled,
        },
      },
    };

    updatePreferences(updates);
  };

  const updateTypeChannels = (type: NotificationType, channels: DeliveryChannel[]) => {
    if (!preferences) return;

    const updates: UpdateNotificationPreferencesDto = {
      typePreferences: {
        [type]: {
          ...preferences.typePreferences[type],
          channels,
        },
      },
    };

    updatePreferences(updates);
  };

  const updateTypePriority = (type: NotificationType, priority: NotificationPriority) => {
    if (!preferences) return;

    const updates: UpdateNotificationPreferencesDto = {
      typePreferences: {
        [type]: {
          ...preferences.typePreferences[type],
          priority,
        },
      },
    };

    updatePreferences(updates);
  };

  const updateQuietHours = (start: string, end: string) => {
    const updates: UpdateNotificationPreferencesDto = {
      quietHours: { start, end },
    };

    updatePreferences(updates);
  };

  const clearQuietHours = () => {
    const updates: UpdateNotificationPreferencesDto = {
      quietHours: undefined,
    };

    updatePreferences(updates);
  };

  const getNotificationTypeLabel = (type: NotificationType): string => {
    return t(`notifications.types.${type}`);
  };

  const getChannelLabel = (channel: DeliveryChannel): string => {
    return t(`notifications.channels.${channel}`);
  };

  const getPriorityLabel = (priority: NotificationPriority): string => {
    return t(`notifications.priority.${priority}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">{t('notifications.preferences.loadError')}</p>
        <button
          onClick={fetchPreferences}
          className="mt-2 text-blue-600 hover:text-blue-800"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              {t('notifications.preferences.title')}
            </h2>
            <button
              onClick={resetToDefaults}
              disabled={saving}
              className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              {t('notifications.preferences.resetDefaults')}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Global Channel Settings */}
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-4">
              {t('notifications.preferences.globalChannels')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.enablePush}
                  onChange={() => toggleGlobalChannel('enablePush')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  📱 {getChannelLabel('push')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.enableEmail}
                  onChange={() => toggleGlobalChannel('enableEmail')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  📧 {getChannelLabel('email')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.enableSms}
                  onChange={() => toggleGlobalChannel('enableSms')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  💬 {getChannelLabel('sms')}
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.enableInApp}
                  onChange={() => toggleGlobalChannel('enableInApp')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  🔔 {getChannelLabel('in_app')}
                </span>
              </label>
            </div>
          </div>

          {/* Quiet Hours */}
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-4">
              {t('notifications.preferences.quietHours')}
            </h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">
                  {t('notifications.preferences.from')}
                </label>
                <input
                  type="time"
                  value={preferences.quietHours?.start || '22:00'}
                  onChange={(e) => updateQuietHours(e.target.value, preferences.quietHours?.end || '08:00')}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">
                  {t('notifications.preferences.to')}
                </label>
                <input
                  type="time"
                  value={preferences.quietHours?.end || '08:00'}
                  onChange={(e) => updateQuietHours(preferences.quietHours?.start || '22:00', e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                />
              </div>
              <button
                onClick={clearQuietHours}
                className="text-sm text-red-600 hover:text-red-800"
              >
                {t('notifications.preferences.clearQuietHours')}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t('notifications.preferences.quietHoursDescription')}
            </p>
          </div>

          {/* Notification Type Preferences */}
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-4">
              {t('notifications.preferences.typeSettings')}
            </h3>
            <div className="space-y-4">
              {Object.entries(preferences.typePreferences).map(([type, settings]) => (
                <div key={type} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.enabled}
                        onChange={(e) => toggleNotificationType(type as NotificationType, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        {getNotificationTypeLabel(type as NotificationType)}
                      </span>
                    </label>

                    <select
                      value={settings.priority}
                      onChange={(e) => updateTypePriority(type as NotificationType, e.target.value as NotificationPriority)}
                      disabled={!settings.enabled}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1 disabled:opacity-50"
                    >
                      <option value="low">{getPriorityLabel('low')}</option>
                      <option value="normal">{getPriorityLabel('normal')}</option>
                      <option value="high">{getPriorityLabel('high')}</option>
                      <option value="urgent">{getPriorityLabel('urgent')}</option>
                    </select>
                  </div>

                  {settings.enabled && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(['push', 'email', 'sms', 'in_app'] as DeliveryChannel[]).map((channel) => (
                        <label key={channel} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={settings.channels.includes(channel)}
                            onChange={(e) => {
                              const newChannels = e.target.checked
                                ? [...settings.channels, channel]
                                : settings.channels.filter(c => c !== channel);
                              updateTypeChannels(type as NotificationType, newChannels);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-1 text-xs text-gray-600">
                            {getChannelLabel(channel)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {saving && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center text-sm text-gray-600">
              <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
              {t('notifications.preferences.saving')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};