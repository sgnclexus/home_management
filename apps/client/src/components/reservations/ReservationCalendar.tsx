import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { CommonArea, TimeSlot } from '@home-management/types';

interface ReservationCalendarProps {
  commonAreas: CommonArea[];
  selectedArea: CommonArea | null;
  selectedDate: Date;
  onAreaSelect: (area: CommonArea) => void;
  onDateSelect: (date: Date) => void;
  onTimeSlotSelect: (timeSlot: TimeSlot) => void;
  availableSlots: TimeSlot[];
  loading?: boolean;
}

export const ReservationCalendar: React.FC<ReservationCalendarProps> = ({
  commonAreas,
  selectedArea,
  selectedDate,
  onAreaSelect,
  onDateSelect,
  onTimeSlotSelect,
  availableSlots,
  loading = false
}) => {
  const { t } = useTranslation('common');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isDateDisabled = (date: Date) => {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    return dateOnly < today;
  };

  const isDateSelected = (date: Date) => {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const selectedDateOnly = new Date(selectedDate);
    selectedDateOnly.setHours(0, 0, 0, 0);
    return dateOnly.getTime() === selectedDateOnly.getTime();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('reservations.selectArea')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {commonAreas.map((area) => (
            <button
              key={area.id}
              onClick={() => onAreaSelect(area)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                selectedArea?.id === area.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h4 className="font-medium text-gray-900">{area.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{area.description}</p>
              <div className="text-xs text-gray-500 mt-2">
                {t('reservations.capacity')}: {area.capacity} | 
                {t('reservations.hours')}: {area.availableHours.start} - {area.availableHours.end}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedArea && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('reservations.selectDate')}
          </h3>
          
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h4 className="text-lg font-medium">
              {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </h4>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
            {calendarDays.map((date, index) => (
              <button
                key={index}
                onClick={() => !isDateDisabled(date) && onDateSelect(date)}
                disabled={isDateDisabled(date)}
                className={`p-2 text-center text-sm rounded-md transition-colors ${
                  isDateSelected(date)
                    ? 'bg-blue-500 text-white'
                    : isDateDisabled(date)
                    ? 'text-gray-300 cursor-not-allowed'
                    : isCurrentMonth(date)
                    ? 'text-gray-900 hover:bg-gray-100'
                    : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                {date.getDate()}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedArea && selectedDate && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('reservations.selectTimeSlot')}
          </h3>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableSlots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => slot.available && onTimeSlotSelect(slot)}
                  disabled={!slot.available}
                  className={`p-3 rounded-md text-sm font-medium transition-colors ${
                    slot.available
                      ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                      : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {formatTimeSlot(slot)}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('reservations.noAvailableSlots')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};