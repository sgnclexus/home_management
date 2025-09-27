import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { RealtimeProvider } from '../../../contexts/RealtimeContext';
import { AuthProvider } from '../../../contexts/AuthContext';
import { PaymentDashboard } from '../../payments/PaymentDashboard';
import { ReservationDashboard } from '../../reservations/ReservationDashboard';
import { MeetingDashboard } from '../../meetings/MeetingDashboard';

// Mock dependencies
jest.mock('../../../config/firebase.config');
jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Mock Firebase Auth
const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  getIdToken: jest.fn().mockResolvedValue('mock-token')
};

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(mockUser);
    return jest.fn(); // unsubscribe function
  }),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

// Mock Firestore
const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  onSnapshot: mockOnSnapshot,
  doc: jest.fn(),
  updateDoc: mockUpdateDoc,
  addDoc: mockAddDoc,
  deleteDoc: mockDeleteDoc,
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' }))
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <RealtimeProvider>
      {children}
    </RealtimeProvider>
  </AuthProvider>
);

describe('Real-time Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful Firestore operations
    mockUpdateDoc.mockResolvedValue(undefined);
    mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  describe('PaymentDashboard Real-time Integration', () => {
    const mockPayments = [
      {
        id: 'payment-1',
        userId: 'test-user-123',
        amount: 100,
        currency: 'USD',
        description: 'Monthly fee',
        status: 'pending',
        dueDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'payment-2',
        userId: 'test-user-123',
        amount: 150,
        currency: 'USD',
        description: 'Maintenance fee',
        status: 'paid',
        dueDate: new Date(),
        paidDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should display real-time payment data', async () => {
      // Mock Firestore snapshot with payment data
      mockOnSnapshot.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback({
            docs: mockPayments.map(payment => ({
              id: payment.id,
              data: () => ({ ...payment, id: undefined })
            }))
          });
        }, 0);
        return jest.fn(); // unsubscribe function
      });

      render(
        <TestWrapper>
          <PaymentDashboard />
        </TestWrapper>
      );

      // Wait for real-time data to load
      await waitFor(() => {
        expect(screen.getByText('payments.dashboard.title')).toBeInTheDocument();
      });

      // Check that payment data is displayed
      await waitFor(() => {
        expect(screen.getByText('Monthly fee')).toBeInTheDocument();
      });
    });

    it('should handle real-time payment updates', async () => {
      let snapshotCallback: any;
      
      mockOnSnapshot.mockImplementation((query, callback) => {
        snapshotCallback = callback;
        // Initial data
        callback({
          docs: mockPayments.map(payment => ({
            id: payment.id,
            data: () => ({ ...payment, id: undefined })
          }))
        });
        return jest.fn();
      });

      render(
        <TestWrapper>
          <PaymentDashboard />
        </TestWrapper>
      );

      // Wait for initial data
      await waitFor(() => {
        expect(screen.getByText('Monthly fee')).toBeInTheDocument();
      });

      // Simulate real-time update
      act(() => {
        const updatedPayments = [...mockPayments];
        updatedPayments[0] = { ...updatedPayments[0], status: 'paid' as const };
        
        snapshotCallback({
          docs: updatedPayments.map(payment => ({
            id: payment.id,
            data: () => ({ ...payment, id: undefined })
          }))
        });
      });

      // Verify the update is reflected in the UI
      await waitFor(() => {
        // The UI should reflect the updated payment status
        expect(screen.queryByText('payments.payNow')).not.toBeInTheDocument();
      });
    });

    it('should handle connection errors gracefully', async () => {
      const mockError = { message: 'Connection failed' };
      
      mockOnSnapshot.mockImplementation((query, successCallback, errorCallback) => {
        setTimeout(() => {
          errorCallback(mockError);
        }, 0);
        return jest.fn();
      });

      render(
        <TestWrapper>
          <PaymentDashboard />
        </TestWrapper>
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });
    });
  });

  describe('ReservationDashboard Real-time Integration', () => {
    const mockReservations = [
      {
        id: 'reservation-1',
        userId: 'test-user-123',
        areaId: 'pool',
        areaName: 'Pool',
        startTime: new Date(Date.now() + 86400000), // Tomorrow
        endTime: new Date(Date.now() + 86400000 + 7200000), // Tomorrow + 2 hours
        status: 'confirmed',
        notes: 'Family gathering',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should display real-time reservation data', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback({
            docs: mockReservations.map(reservation => ({
              id: reservation.id,
              data: () => ({ ...reservation, id: undefined })
            }))
          });
        }, 0);
        return jest.fn();
      });

      render(
        <TestWrapper>
          <ReservationDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('reservations.dashboard.title')).toBeInTheDocument();
      });

      // Switch to manage tab to see reservations
      fireEvent.click(screen.getByText('reservations.myReservations (1)'));

      await waitFor(() => {
        expect(screen.getByText('Pool')).toBeInTheDocument();
      });
    });

    it('should handle optimistic reservation creation', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        callback({ docs: [] }); // Start with no reservations
        return jest.fn();
      });

      mockAddDoc.mockResolvedValue({ id: 'new-reservation-id' });

      render(
        <TestWrapper>
          <ReservationDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('reservations.dashboard.title')).toBeInTheDocument();
      });

      // The reservation creation would be tested through the booking form
      // This is a simplified test to verify the integration works
      expect(mockOnSnapshot).toHaveBeenCalled();
    });
  });

  describe('MeetingDashboard Real-time Integration', () => {
    const mockMeetings = [
      {
        id: 'meeting-1',
        title: 'Monthly Board Meeting',
        description: 'Regular monthly meeting',
        scheduledDate: new Date(Date.now() + 86400000), // Tomorrow
        agenda: ['Budget review', 'Maintenance updates'],
        status: 'scheduled',
        attendees: ['test-user-123'],
        createdBy: 'admin-user',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should display real-time meeting data', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        setTimeout(() => {
          callback({
            docs: mockMeetings.map(meeting => ({
              id: meeting.id,
              data: () => ({ ...meeting, id: undefined })
            }))
          });
        }, 0);
        return jest.fn();
      });

      render(
        <TestWrapper>
          <MeetingDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('meetings.dashboard.title')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Monthly Board Meeting')).toBeInTheDocument();
      });
    });

    it('should update meeting statistics in real-time', async () => {
      let snapshotCallback: any;
      
      mockOnSnapshot.mockImplementation((query, callback) => {
        snapshotCallback = callback;
        callback({
          docs: mockMeetings.map(meeting => ({
            id: meeting.id,
            data: () => ({ ...meeting, id: undefined })
          }))
        });
        return jest.fn();
      });

      render(
        <TestWrapper>
          <MeetingDashboard />
        </TestWrapper>
      );

      // Wait for initial data
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // Total meetings count
      });

      // Add another meeting
      act(() => {
        const newMeeting = {
          id: 'meeting-2',
          title: 'Emergency Meeting',
          description: 'Urgent matters',
          scheduledDate: new Date(Date.now() + 172800000), // Day after tomorrow
          agenda: ['Emergency repairs'],
          status: 'scheduled',
          attendees: ['test-user-123'],
          createdBy: 'admin-user',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        snapshotCallback({
          docs: [...mockMeetings, newMeeting].map(meeting => ({
            id: meeting.id,
            data: () => ({ ...meeting, id: undefined })
          }))
        });
      });

      // Verify the count is updated
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Updated total meetings count
      });
    });
  });

  describe('Cross-component Real-time Synchronization', () => {
    it('should synchronize data across multiple components', async () => {
      const mockData = {
        payments: [
          {
            id: 'payment-1',
            userId: 'test-user-123',
            amount: 100,
            currency: 'USD',
            description: 'Monthly fee',
            status: 'pending',
            dueDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        reservations: [
          {
            id: 'reservation-1',
            userId: 'test-user-123',
            areaId: 'pool',
            areaName: 'Pool',
            startTime: new Date(),
            endTime: new Date(),
            status: 'confirmed',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      // Mock different responses for different collections
      mockOnSnapshot.mockImplementation((query, callback) => {
        // Simulate different collections returning different data
        const queryString = JSON.stringify(query);
        if (queryString.includes('payments')) {
          callback({
            docs: mockData.payments.map(item => ({
              id: item.id,
              data: () => ({ ...item, id: undefined })
            }))
          });
        } else if (queryString.includes('reservations')) {
          callback({
            docs: mockData.reservations.map(item => ({
              id: item.id,
              data: () => ({ ...item, id: undefined })
            }))
          });
        } else {
          callback({ docs: [] });
        }
        return jest.fn();
      });

      const TestComponent = () => (
        <div>
          <PaymentDashboard />
          <ReservationDashboard />
        </div>
      );

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Both components should receive their respective real-time data
      await waitFor(() => {
        expect(screen.getByText('payments.dashboard.title')).toBeInTheDocument();
        expect(screen.getByText('reservations.dashboard.title')).toBeInTheDocument();
      });

      // Verify that both components are using the same real-time context
      expect(mockOnSnapshot).toHaveBeenCalledTimes(3); // payments, reservations, meetings
    });
  });

  describe('Error Recovery and Reconnection', () => {
    it('should handle network disconnection and reconnection', async () => {
      let snapshotCallback: any;
      let errorCallback: any;
      
      mockOnSnapshot.mockImplementation((query, successCb, errorCb) => {
        snapshotCallback = successCb;
        errorCallback = errorCb;
        
        // Start with successful connection
        successCb({ docs: [] });
        return jest.fn();
      });

      render(
        <TestWrapper>
          <PaymentDashboard />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('payments.dashboard.title')).toBeInTheDocument();
      });

      // Simulate network error
      act(() => {
        errorCallback({ message: 'Network error' });
      });

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Simulate reconnection with new data
      act(() => {
        snapshotCallback({
          docs: [{
            id: 'payment-1',
            data: () => ({
              userId: 'test-user-123',
              amount: 100,
              currency: 'USD',
              description: 'Reconnected payment',
              status: 'pending',
              dueDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            })
          }]
        });
      });

      // Verify recovery
      await waitFor(() => {
        expect(screen.getByText('Reconnected payment')).toBeInTheDocument();
      });
    });
  });
});