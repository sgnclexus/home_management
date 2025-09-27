import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'next-i18next';
import { UserRole, Language } from '@home-management/types';

interface UserProfileData {
  displayName: string;
  apartmentNumber: string;
  phoneNumber: string;
  preferredLanguage: Language;
}

export const UserProfile: React.FC = () => {
  const { t } = useTranslation('common');
  const { user, userRole } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData>({
    displayName: '',
    apartmentNumber: '',
    phoneNumber: '',
    preferredLanguage: 'es',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load user profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setProfileData({
            displayName: userData.displayName || '',
            apartmentNumber: userData.apartmentNumber || '',
            phoneNumber: userData.phoneNumber || '',
            preferredLanguage: userData.preferredLanguage || 'es',
          });
        } else {
          setError(t('profile.loadError'));
        }
      } catch (error) {
        setError(t('profile.loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        setSuccess(t('profile.updateSuccess'));
      } else {
        const errorData = await response.json();
        setError(errorData.message || t('profile.updateError'));
      }
    } catch (error) {
      setError(t('profile.updateError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('profile.title')}
        </h2>
        <div className="text-sm text-gray-500">
          {t('profile.role')}: <span className="font-medium">{t(`roles.${userRole}`)}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              {t('profile.displayName')}
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={profileData.displayName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="apartmentNumber" className="block text-sm font-medium text-gray-700 mb-1">
              {t('profile.apartmentNumber')}
            </label>
            <input
              type="text"
              id="apartmentNumber"
              name="apartmentNumber"
              value={profileData.apartmentNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('profile.apartmentPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              {t('profile.phoneNumber')}
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={profileData.phoneNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('profile.phonePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="preferredLanguage" className="block text-sm font-medium text-gray-700 mb-1">
              {t('profile.preferredLanguage')}
            </label>
            <select
              id="preferredLanguage"
              name="preferredLanguage"
              value={profileData.preferredLanguage}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="es">{t('languages.spanish')}</option>
              <option value="en">{t('languages.english')}</option>
            </select>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="text-sm text-gray-600 mb-4">
            <p><strong>{t('profile.email')}:</strong> {user?.email}</p>
            <p><strong>{t('profile.uid')}:</strong> {user?.uid}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </form>
    </div>
  );
};