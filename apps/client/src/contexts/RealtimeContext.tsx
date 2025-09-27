import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { 
  useRealtimePayments, 
  useRealtimeReservations, 
  useRealtimeMeetings,
  useConnectionStatus,
  ConnectionStatus
} from '../hooks/useRealtimeData';
import { 
  useOptimisticPayments, 
  useOptimisticReservations, 
  useOptimisticMeetings,
  OptimisticAction
} from '../hooks/useOptimisticUpdates';
import { useAuth } from './AuthContext';
import { Payment, Reservation, Meeting } from '@home-management/types';

// Real-time notification interface
export interface RealtimeNotification {
  id: string;
  type: 'payment' | 'reservation' | 'meeting' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

// Real-time context interface
interface RealtimeContextType {
  // Connection status
  connectionStatus: ConnectionStatus;
  
  // Data states
  payments: {
    data: Payment[];
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  };
  
  reservations: {
    data: Reservation[];
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  };
  
  meetings: {
    data: Meeting[];
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
  };
  
  // Notifications
  notifications: RealtimeNotification[];
  unreadCount: number;
  
  // Actions
  updatePayment: (id: string, data: Partial<Payment>) => Promise<void>;
  updateReservation: (id: string, data: Partial<Reservation>) => Promise<void>;
  updateMeeting: (id: string, data: Partial<Meeting>) => Promise<void>;
  
  createPayment: (data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  createReservation: (data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  createMeeting: (data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  
  deletePayment: (id: string) => Promise<void>;
  deleteReservation: (id: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  
  // Notification actions
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  
  // Utility functions
  refreshData: () => void;
  isDataStale: () => boolean;
}

// Create realtime context
const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Realtime provider props
interface RealtimeProviderProps {
  children: ReactNode;
}

// Realtime provider component
export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children }) => {
  const { user, userRole } = useAuth();
  const connectionStatus = useConnectionStatus();
  
  // State for notifications
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  
  // Real-time data hooks with optimistic updates enabled
  const paymentsState = useRealtimePayments(user?.uid, { 
    enableOptimisticUpdates: true,
    retryOnError: true,
    maxRetries: 3
  });
  
  const reservationsState = useRealtimeReservations(user?.uid, { 
    enableOptimisticUpdates: true,
    retryOnError: true,
    maxRetries: 3
  });
  
  const meetingsState = useRealtimeMeetings({ 
    enableOptimisticUpdates: true,
    retryOnError: true,
    maxRetries: 3
  });
  
  // Optimistic updates hooks
  const paymentsOptimistic = useOptimisticPayments({
    onSuccess: (id, data) => {
      console.log('Payment update successful:', id, data);
      addNotification({
        type: 'payment',
        title: 'Payment Updated',
        message: 'Your payment has been processed successfully.',
        data: { paymentId: id }
      });
    },
    onError: (id, error) => {
      console.error('Payment update failed:', id, error);
      addNotification({
        type: 'payment',
        title: 'Payment Error',
        message: 'Failed to process payment. Please try again.',
        data: { paymentId: id, error: error.message }
      });
    },
    conflictResolution: 'server-wins'
  });
  
  const reservationsOptimistic = useOptimisticReservations({
    onSuccess: (id, data) => {
      console.log('Reservation update successful:', id, data);
      addNotification({
        type: 'reservation',
        title: 'Reservation Updated',
        message: 'Your reservation has been updated successfully.',
        data: { reservationId: id }
      });
    },
    onError: (id, error) => {
      console.error('Reservation update failed:', id, error);
      addNotification({
        type: 'reservation',
        title: 'Reservation Error',
        message: 'Failed to update reservation. Please try again.',
        data: { reservationId: id, error: error.message }
      });
    },
    conflictResolution: 'merge'
  });
  
  const meetingsOptimistic = useOptimisticMeetings({
    onSuccess: (id, data) => {
      console.log('Meeting update successful:', id, data);
      addNotification({
        type: 'meeting',
        title: 'Meeting Updated',
        message: 'Meeting information has been updated.',
        data: { meetingId: id }
      });
    },
    onError: (id, error) => {
      console.error('Meeting update failed:', id, error);
      addNotification({
        type: 'meeting',
        title: 'Meeting Error',
        message: 'Failed to update meeting. Please try again.',
        data: { meetingId: id, error: error.message }
      });
    },
    conflictResolution: 'server-wins'
  });
  
  // Add notification helper
  const addNotification = useCallback((notification: Omit<RealtimeNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: RealtimeNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep only last 50 notifications
  }, []);
  
  // CRUD operations with optimistic updates
  const updatePayment = useCallback(async (id: string, data: Partial<Payment>) => {
    const originalPayment = paymentsState.data.find(p => p.id === id);
    paymentsOptimistic.applyOptimisticUpdate(id, 'update', data, originalPayment);
  }, [paymentsState.data, paymentsOptimistic]);
  
  const updateReservation = useCallback(async (id: string, data: Partial<Reservation>) => {
    const originalReservation = reservationsState.data.find(r => r.id === id);
    reservationsOptimistic.applyOptimisticUpdate(id, 'update', data, originalReservation);
  }, [reservationsState.data, reservationsOptimistic]);
  
  const updateMeeting = useCallback(async (id: string, data: Partial<Meeting>) => {
    const originalMeeting = meetingsState.data.find(m => m.id === id);
    meetingsOptimistic.applyOptimisticUpdate(id, 'update', data, originalMeeting);
  }, [meetingsState.data, meetingsOptimistic]);
  
  const createPayment = useCallback(async (data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const tempId = `temp-${Date.now()}`;
    const paymentData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    paymentsOptimistic.applyOptimisticUpdate(tempId, 'create', paymentData);
  }, [paymentsOptimistic]);
  
  const createReservation = useCallback(async (data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const tempId = `temp-${Date.now()}`;
    const reservationData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    reservationsOptimistic.applyOptimisticUpdate(tempId, 'create', reservationData);
  }, [reservationsOptimistic]);
  
  const createMeeting = useCallback(async (data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
    const tempId = `temp-${Date.now()}`;
    const meetingData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    meetingsOptimistic.applyOptimisticUpdate(tempId, 'create', meetingData);
  }, [meetingsOptimistic]);
  
  const deletePayment = useCallback(async (id: string) => {
    const originalPayment = paymentsState.data.find(p => p.id === id);
    paymentsOptimistic.applyOptimisticUpdate(id, 'delete', {}, originalPayment);
  }, [paymentsState.data, paymentsOptimistic]);
  
  const deleteReservation = useCallback(async (id: string) => {
    const originalReservation = reservationsState.data.find(r => r.id === id);
    reservationsOptimistic.applyOptimisticUpdate(id, 'delete', {}, originalReservation);
  }, [reservationsState.data, reservationsOptimistic]);
  
  const deleteMeeting = useCallback(async (id: string) => {
    const originalMeeting = meetingsState.data.find(m => m.id === id);
    meetingsOptimistic.applyOptimisticUpdate(id, 'delete', {}, originalMeeting);
  }, [meetingsState.data, meetingsOptimistic]);
  
  // Notification actions
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);
  
  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);
  
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);
  
  // Utility functions
  const refreshData = useCallback(() => {
    // Force refresh by clearing cache and reconnecting
    // This would typically involve clearing local state and re-establishing listeners
    console.log('Refreshing real-time data...');
  }, []);
  
  const isDataStale = useCallback(() => {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    const paymentsStale = paymentsState.lastUpdated 
      ? now.getTime() - paymentsState.lastUpdated.getTime() > staleThreshold
      : true;
      
    const reservationsStale = reservationsState.lastUpdated 
      ? now.getTime() - reservationsState.lastUpdated.getTime() > staleThreshold
      : true;
      
    const meetingsStale = meetingsState.lastUpdated 
      ? now.getTime() - meetingsState.lastUpdated.getTime() > staleThreshold
      : true;
    
    return paymentsStale || reservationsStale || meetingsStale;
  }, [paymentsState.lastUpdated, reservationsState.lastUpdated, meetingsState.lastUpdated]);
  
  // Calculate unread notifications count
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Monitor connection status changes
  useEffect(() => {
    if (connectionStatus === 'connected') {
      addNotification({
        type: 'system',
        title: 'Connected',
        message: 'Real-time synchronization is active.'
      });
    } else if (connectionStatus === 'error') {
      addNotification({
        type: 'system',
        title: 'Connection Error',
        message: 'Real-time synchronization is experiencing issues.'
      });
    } else if (connectionStatus === 'reconnecting') {
      addNotification({
        type: 'system',
        title: 'Reconnecting',
        message: 'Attempting to restore real-time synchronization...'
      });
    }
  }, [connectionStatus, addNotification]);
  
  // Monitor data changes for notifications
  useEffect(() => {
    // Add notifications for new payments
    if (paymentsState.data.length > 0 && paymentsState.lastUpdated) {
      const recentPayments = paymentsState.data.filter(payment => {
        const paymentTime = new Date(payment.updatedAt);
        const timeDiff = Date.now() - paymentTime.getTime();
        return timeDiff < 10000; // Last 10 seconds
      });
      
      recentPayments.forEach(payment => {
        if (payment.status === 'paid') {
          addNotification({
            type: 'payment',
            title: 'Payment Received',
            message: `Payment of ${payment.currency} ${payment.amount} has been processed.`,
            data: { paymentId: payment.id }
          });
        }
      });
    }
  }, [paymentsState.data, paymentsState.lastUpdated, addNotification]);
  
  useEffect(() => {
    // Add notifications for new reservations
    if (reservationsState.data.length > 0 && reservationsState.lastUpdated) {
      const recentReservations = reservationsState.data.filter(reservation => {
        const reservationTime = new Date(reservation.updatedAt);
        const timeDiff = Date.now() - reservationTime.getTime();
        return timeDiff < 10000; // Last 10 seconds
      });
      
      recentReservations.forEach(reservation => {
        if (reservation.status === 'confirmed') {
          addNotification({
            type: 'reservation',
            title: 'Reservation Confirmed',
            message: `Your reservation for ${reservation.areaName} has been confirmed.`,
            data: { reservationId: reservation.id }
          });
        }
      });
    }
  }, [reservationsState.data, reservationsState.lastUpdated, addNotification]);
  
  useEffect(() => {
    // Add notifications for new meetings
    if (meetingsState.data.length > 0 && meetingsState.lastUpdated) {
      const recentMeetings = meetingsState.data.filter(meeting => {
        const meetingTime = new Date(meeting.updatedAt);
        const timeDiff = Date.now() - meetingTime.getTime();
        return timeDiff < 10000; // Last 10 seconds
      });
      
      recentMeetings.forEach(meeting => {
        if (meeting.status === 'scheduled') {
          addNotification({
            type: 'meeting',
            title: 'New Meeting Scheduled',
            message: `Meeting "${meeting.title}" has been scheduled.`,
            data: { meetingId: meeting.id }
          });
        }
      });
    }
  }, [meetingsState.data, meetingsState.lastUpdated, addNotification]);
  
  const value: RealtimeContextType = {
    connectionStatus,
    payments: {
      data: paymentsState.data,
      loading: paymentsState.loading,
      error: paymentsState.error,
      lastUpdated: paymentsState.lastUpdated
    },
    reservations: {
      data: reservationsState.data,
      loading: reservationsState.loading,
      error: reservationsState.error,
      lastUpdated: reservationsState.lastUpdated
    },
    meetings: {
      data: meetingsState.data,
      loading: meetingsState.loading,
      error: meetingsState.error,
      lastUpdated: meetingsState.lastUpdated
    },
    notifications,
    unreadCount,
    updatePayment,
    updateReservation,
    updateMeeting,
    createPayment,
    createReservation,
    createMeeting,
    deletePayment,
    deleteReservation,
    deleteMeeting,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    refreshData,
    isDataStale
  };
  
  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

// Custom hook to use realtime context
export const useRealtime = (): RealtimeContextType => {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};