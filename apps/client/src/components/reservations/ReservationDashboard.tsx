import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { ReservationCalendar } from './ReservationCalendar';
import { ReservationBookingForm } from './ReservationBookingForm';
import { DataLoadingState, RealtimeStatusBadge, OptimisticUpdateIndicator } from '../realtime/LoadingStates';
import { formatDateTime, formatDateTimeRange } from '../../utils/dateUtils';
import { 
  Reservation, 
  CommonArea, 
  TimeSlot, 
  CreateReservationDto,
  ReservationStatus 
} from '@home-management/types';

export const ReservationDashboard: React.FC = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { reservations: realtimeReservations, createReservation, updateReservation, refreshData } = useRealtime();
  
  // State management
  const [activeTab, setActiveTab] = useState<'book' | 'manage'>('book');
  const [commonAreas, setCommonAreas] = useState<CommonArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<CommonArea | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  
  // Loading states
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Load common areas data (this would typically come from an API)
  useEffect(() => {
    const loadCommonAreas = async () => {
      // Mock common areas data - in real app, this would be an API call
      const mockAreas: CommonArea[] = [
        {
          id: '1',
          name: 'Piscina',
          description: 'Piscina comunitaria con área de descanso',
          capacity: 20,
          availableHours: { start: '06:00', end: '22:00' },
          isActive: true,
          rules: [
            'No se permite comida en el área de la piscina',
            'Los niños deben estar acompañados por un adulto',
            'Máximo 2 horas de uso continuo'
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          name: 'Gimnasio',
          description: 'Gimnasio equipado con máquinas de ejercicio',
          capacity: 10,
          availableHours: { start: '05:00', end: '23:00' },
          isActive: true,
          rules: [
            'Usar ropa deportiva apropiada',
            'Limpiar equipos después del uso',
            'Máximo 1.5 horas de uso continuo'
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '3',
          name: 'Salón de Fiestas',
          description: 'Salón para eventos y celebraciones',
          capacity: 50,
          availableHours: { start: '08:00', end: '23:00' },
          isActive: true,
          rules: [
            'Reserva de 5 horas por bloque',
            'Máximo 2 reservas por día',
            'Limpieza obligatoria después del evento',
            'No se permite música después de las 22:00'
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      setCommonAreas(mockAreas);
    };

    loadCommonAreas();
  }, []);

  // Load available time slots when area and date are selected
  useEffect(() => {
    const loadAvailableSlots = async () => {
      if (!selectedArea || !selectedDate) {
        setAvailableSlots([]);
        return;
      }

      try {
        setSlotsLoading(true);
        
        // Mock time slots generation
        const slots: TimeSlot[] = [];
        const startHour = parseInt(selectedArea.availableHours.start.split(':')[0]);
        const endHour = parseInt(selectedArea.availableHours.end.split(':')[0]);
        
        // Special handling for party room (5-hour slots, max 2 per day)
        if (selectedArea.name === 'Salón de Fiestas') {
          // Two 5-hour slots: 8:00-13:00 and 15:00-20:00
          const morningSlot = {
            start: new Date(selectedDate),
            end: new Date(selectedDate),
            available: Math.random() > 0.3
          };
          morningSlot.start.setHours(8, 0, 0, 0);
          morningSlot.end.setHours(13, 0, 0, 0);
          
          const afternoonSlot = {
            start: new Date(selectedDate),
            end: new Date(selectedDate),
            available: Math.random() > 0.3
          };
          afternoonSlot.start.setHours(15, 0, 0, 0);
          afternoonSlot.end.setHours(20, 0, 0, 0);
          
          slots.push(morningSlot, afternoonSlot);
        } else {
          // Regular 2-hour slots for other areas
          for (let hour = startHour; hour < endHour; hour += 2) {
            const start = new Date(selectedDate);
            start.setHours(hour, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(hour + 2, 0, 0, 0);
            
            // Mock availability - some slots are taken
            const available = Math.random() > 0.3;
            
            slots.push({ start, end, available });
          }
        }
        
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Error loading available slots:', err);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    loadAvailableSlots();
  }, [selectedArea, selectedDate]);

  const handleAreaSelect = (area: CommonArea) => {
    setSelectedArea(area);
    setSelectedTimeSlot(null);
    setShowBookingForm(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
    setShowBookingForm(false);
  };

  const handleTimeSlotSelect = (timeSlot: TimeSlot) => {
    if (timeSlot.available) {
      setSelectedTimeSlot(timeSlot);
      setShowBookingForm(true);
    }
  };

  const handleBookingSubmit = async (reservationData: CreateReservationDto) => {
    try {
      setBookingLoading(true);
      
      // Create new reservation using real-time context
      const newReservationData = {
        userId: user?.uid || '',
        areaId: reservationData.areaId,
        areaName: selectedArea?.name || '',
        startTime: new Date(reservationData.startTime),
        endTime: new Date(reservationData.endTime),
        status: 'confirmed' as ReservationStatus,
        notes: reservationData.notes
      };

      await createReservation(newReservationData);
      
      setShowBookingForm(false);
      setSelectedTimeSlot(null);
      setActiveTab('manage');
      
      // Success notification will be handled by the real-time context
      
    } catch (err) {
      console.error('Error creating reservation:', err);
      alert(t('reservations.bookingError'));
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!confirm(t('reservations.cancelConfirmation'))) {
      return;
    }

    try {
      // Update reservation status using real-time context
      await updateReservation(reservationId, { status: 'cancelled' as ReservationStatus });
      
      // Success notification will be handled by the real-time context
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      alert(t('reservations.cancelError'));
    }
  };

  const formatReservationDateTime = (date: any) => {
    return formatDateTime(date, 'es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: ReservationStatus) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DataLoadingState
      loading={realtimeReservations.loading}
      error={realtimeReservations.error}
      retryAction={refreshData}
    >
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-900">
              {t('reservations.dashboard.title')}
            </h2>
            <RealtimeStatusBadge lastUpdated={realtimeReservations.lastUpdated} />
          </div>
          <p className="text-gray-600">
            {t('reservations.dashboard.description')}
          </p>
        </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('book')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'book'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('reservations.bookArea')}
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('reservations.myReservations')} ({realtimeReservations.data.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'book' && (
            <div className="space-y-6">
              {!showBookingForm ? (
                <ReservationCalendar
                  commonAreas={commonAreas}
                  selectedArea={selectedArea}
                  selectedDate={selectedDate}
                  onAreaSelect={handleAreaSelect}
                  onDateSelect={handleDateSelect}
                  onTimeSlotSelect={handleTimeSlotSelect}
                  availableSlots={availableSlots}
                  loading={slotsLoading}
                />
              ) : (
                <ReservationBookingForm
                  selectedArea={selectedArea}
                  selectedDate={selectedDate}
                  selectedTimeSlot={selectedTimeSlot}
                  onSubmit={handleBookingSubmit}
                  onCancel={() => setShowBookingForm(false)}
                  loading={bookingLoading}
                />
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('reservations.myReservations')}
              </h3>
              
              {realtimeReservations.data.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">
                    {t('reservations.noReservations')}
                  </div>
                  <button
                    onClick={() => setActiveTab('book')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    {t('reservations.makeFirstReservation')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {realtimeReservations.data.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {reservation.areaName}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                              {t(`reservations.status.${reservation.status}`)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>
                              <strong>{t('reservations.dateTime')}:</strong> {formatDateTimeRange(reservation.startTime, reservation.endTime)}
                            </div>
                            {reservation.notes && (
                              <div>
                                <strong>{t('reservations.notes')}:</strong> {reservation.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {reservation.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelReservation(reservation.id)}
                            className="ml-4 text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            {t('reservations.cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </DataLoadingState>
  );
};