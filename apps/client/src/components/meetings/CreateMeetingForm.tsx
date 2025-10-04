import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { CreateMeetingDto, User, UserRole } from '@home-management/types';
import { useAuth } from '../../contexts/AuthContext';

interface CreateMeetingFormProps {
  onSuccess?: (meeting: any) => void;
  onCancel?: () => void;
  className?: string;
}

export const CreateMeetingForm: React.FC<CreateMeetingFormProps> = ({
  onSuccess,
  onCancel,
  className = ''
}) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState<CreateMeetingDto>({
    title: '',
    description: '',
    scheduledDate: new Date(),
    agenda: [''],
    attendees: [],
    location: '',
    duration: 60,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUsers(userData.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate form
      if (!formData.title.trim()) {
        throw new Error(t('meetings.create.validation.titleRequired'));
      }

      if (!formData.description.trim()) {
        throw new Error(t('meetings.create.validation.descriptionRequired'));
      }

      if (formData.attendees.length === 0) {
        throw new Error(t('meetings.create.validation.attendeesRequired'));
      }

      // Filter out empty agenda items
      const cleanedAgenda = formData.agenda.filter(item => item.trim() !== '');
      if (cleanedAgenda.length === 0) {
        throw new Error(t('meetings.create.validation.agendaRequired'));
      }

      const meetingData = {
        ...formData,
        agenda: cleanedAgenda,
      };

      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`,
        },
        body: JSON.stringify(meetingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('meetings.create.error'));
      }

      const meeting = await response.json();
      onSuccess?.(meeting);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('meetings.create.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateMeetingDto, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const addAgendaItem = () => {
    setFormData(prev => ({
      ...prev,
      agenda: [...prev.agenda, ''],
    }));
  };

  const removeAgendaItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      agenda: prev.agenda.filter((_, i) => i !== index),
    }));
  };

  const updateAgendaItem = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      agenda: prev.agenda.map((item, i) => i === index ? value : item),
    }));
  };

  const toggleAttendee = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.includes(userId)
        ? prev.attendees.filter(id => id !== userId)
        : [...prev.attendees, userId],
    }));
  };

  const selectAllResidents = () => {
    const residentIds = users
      .filter(u => u.role === UserRole.RESIDENT)
      .map(u => u.uid);
    
    setFormData(prev => ({
      ...prev,
      attendees: [...new Set([...prev.attendees, ...residentIds])],
    }));
  };

  const formatDateTimeLocal = (date: Date | string | undefined) => {
    if (!date) return '';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return '';
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.warn('Invalid date format for datetime-local:', date);
      return '';
    }
  };

  return (
    <div className={`bg-white shadow-lg rounded-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">
          {t('meetings.create.title')}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              {t('meetings.create.fields.title')} *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('meetings.create.placeholders.title')}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              {t('meetings.create.fields.description')} *
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('meetings.create.placeholders.description')}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700">
                {t('meetings.create.fields.scheduledDate')} *
              </label>
              <input
                type="datetime-local"
                id="scheduledDate"
                value={formatDateTimeLocal(formData.scheduledDate)}
                onChange={(e) => handleInputChange('scheduledDate', new Date(e.target.value))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                {t('meetings.create.fields.duration')}
              </label>
              <select
                id="duration"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={30}>30 {t('common.minutes')}</option>
                <option value={60}>1 {t('common.hour')}</option>
                <option value={90}>1.5 {t('common.hours')}</option>
                <option value={120}>2 {t('common.hours')}</option>
                <option value={180}>3 {t('common.hours')}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
              {t('meetings.create.fields.location')}
            </label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('meetings.create.placeholders.location')}
            />
          </div>
        </div>

        {/* Agenda */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              {t('meetings.create.fields.agenda')} *
            </label>
            <button
              type="button"
              onClick={addAgendaItem}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t('meetings.create.addAgendaItem')}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {formData.agenda.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateAgendaItem(index, e.target.value)}
                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('meetings.create.placeholders.agendaItem')}
                />
                {formData.agenda.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAgendaItem(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Attendees */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              {t('meetings.create.fields.attendees')} * ({formData.attendees.length} {t('common.selected')})
            </label>
            <button
              type="button"
              onClick={selectAllResidents}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t('meetings.create.selectAllResidents')}
            </button>
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md">
            {users.map((user) => (
              <div key={user.uid} className="flex items-center p-3 hover:bg-gray-50">
                <input
                  type="checkbox"
                  id={`attendee-${user.uid}`}
                  checked={formData.attendees.includes(user.uid)}
                  onChange={() => toggleAttendee(user.uid)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`attendee-${user.uid}`} className="ml-3 flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800' :
                      user.role === UserRole.VIGILANCE ? 'bg-blue-100 text-blue-800' :
                      user.role === UserRole.RESIDENT ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {t(`users.roles.${user.role}`)}
                    </span>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('common.creating') : t('meetings.create.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};