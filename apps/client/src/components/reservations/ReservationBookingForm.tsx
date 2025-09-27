import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { CommonArea, TimeSlot, CreateReservationDto } from '@home-management/types';

interface ReservationBookingFormProps {
  selectedArea: CommonArea | null;
  selectedDate: Date | null;
  selectedTimeSlot: TimeSlot | null;
  onSubmit: (reservationData: CreateReservationDto) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const ReservationBookingForm: React.FC<ReservationBookingFormProps> = ({
  selectedArea,
  selectedDate,
  selectedTimeSlot,
  onSubmit,
  onCancel,
  loading = false
}) => {
  const { t } = useTranslation('common');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedArea || !selectedDate || !selectedTimeSlot) {
      return;
    }

    setIsSubmitting(true);
    try {
      const reservationData: CreateReservationDto = {
        areaId: selectedArea.id,
        startTime: selectedTimeSlot.start,
        endTime: selectedTimeSlot.end,
        notes: notes.trim() || undefined
      };

      await onSubmit(reservationData);
    } catch (error) {
      console.error('Error creating reservation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTimeSlot = (slot: TimeSlot) => {
    const startTime = new Date(slot.start).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const endTime = new Date(slot.end).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${startTime} - ${endTime}`;
  };

  if (!selectedArea || !selectedDate || !selectedTimeSlot) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {t('reservations.confirmBooking')}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Booking Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">
            {t('reservations.bookingSummary')}
          </h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('reservations.area')}:</span>
              <span className="font-medium">{selectedArea.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('reservations.date')}:</span>
              <span className="font-medium">{formatDateTime(selectedDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('reservations.time')}:</span>
              <span className="font-medium">{formatTimeSlot(selectedTimeSlot)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('reservations.capacity')}:</span>
              <span className="font-medium">{selectedArea.capacity} {t('reservations.people')}</span>
            </div>
          </div>
        </div>

        {/* Area Rules */}
        {selectedArea.rules && selectedArea.rules.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">
              {t('reservations.areaRules')}
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {selectedArea.rules.map((rule, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes Field */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            {t('reservations.notes')} ({t('reservations.optional')})
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder={t('reservations.notesPlaceholder')}
            maxLength={500}
          />
          <div className="text-xs text-gray-500 mt-1">
            {notes.length}/500 {t('reservations.characters')}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('reservations.booking')}
              </div>
            ) : (
              t('reservations.confirmReservation')
            )}
          </button>
        </div>
      </form>
    </div>
  );
};