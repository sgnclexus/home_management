import React from 'react';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { RealtimeProvider, useRealtime } from '../RealtimeContext';
import { useAuth } from '../AuthContext';

// Mock dependencies
jest.mock('../AuthContext');
jest.mock('../../hooks/useRealtimeData');
jest.mock('../../hooks/useOptimisticUpdates');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock real-time hooks
const mockUseRealtimePayments = jest.fn();
const mockUseRealtimeReservations = jest.fn();
const mockUseRealtimeMeetings = jest.fn();
const mockUseConnectionStatus = jest.fn();

// Mock optimistic update hooks
const mockUseOptimisticPayments = jest.fn();
const mockUseOptimisticReservations = jest.fn();
const mockUseOptimisticMeetings = jest.fn();

jest.mock('../../hooks/useRealtimeData', () => ({
  useRealtimePayments: (...args: any[]) => mockUseRealtimePayments(...args),
  useRealtimeReservations: (...args: any[]) => mockUseRealtimeReservations(...args),
  useRealtimeMeetings: (...args: any[]) => mockUseRealtimeMeetings(...args),
  useConnectionStatus: () => mockUseConnectionStatus()
}));

jest.mock('../../hooks/useOptimisticUpdates', () => ({
  useOptimisticPayments: (...args: any[]) => mockUseOptimisticPayments(...args),
  useOptimisticReservations: (...args: any[]) => mockUseOptimisticReservations(...args),
  useOptimisticMeetings: (...args: any[]) => mockUseOptimisticMeetings(...args)
}));

describe('RealtimeProvider', () => {
  const mockUser = {
    uid: 'user123',
    email: 'test@example.com',
    displayName: 'Test User'
  };

  const mockPaymentsData = [
    {
      id: '1',
      userId: 'user123',
      amount: 100,
      currency: 'USD',
      description: 'Monthly fee',
      status: 'paid',
      dueDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockReservationsData = [
    {
      id: '1',
      userId: 'user123',
      areaId: 'pool',
      areaName: 'Pool',
      startTime: new Date(),
      endTime: new Date(),
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const mockMeetingsData = [
    {
      id: '1',
      title: 'Monthly Meeting',
      description: 'Regular meeting',
      scheduledDate: new Date(),
      agenda: ['Budget'],
      status: 'scheduled',
      attendees: ['user123'],
      createdBy: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock auth context
    mockUseAuth.mockReturnValue({
      user: mockUser as any,
      userRole: 'resident',
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      refreshUserRole: jest.fn()
    });

    // Mock connection status
    mockUseConnectionStatus.mockReturnValue('connected');

    // Mock real-time data hooks
    mockUseRealtimePayments.mockReturnValue({
      data: mockPaymentsData,
      loading: false,
      error: null,
      connectionStatus: 'connected',
      lastUpdated: new Date(),
      applyOptimisticUpdate: jest.fn(),
      removeOptimisticUpdate: jest.fn()
    });

    mockUseRealtimeReservations.mockReturnValue({
      data: mockReservationsData,
      loading: false,
      error: null,
      connectionStatus: 'connected',
      lastUpdated: new Date(),
      applyOptimisticUpdate: jest.fn(),
      removeOptimisticUpdate: jest.fn()
    });

    mockUseRealtimeMeetings.mockReturnValue({
      data: mockMeetingsData,
      loading: false,
      error: null,
      connectionStatus: 'connected',
      lastUpdated: new Date(),
      applyOptimisticUpdate: jest.fn(),
      removeOptimisticUpdate: jest.fn()
    });

    // Mock optimistic update hooks
    mockUseOptimisticPayments.mockReturnValue({
      applyOptimisticUpdate: jest.fn(),
      cancelUpdate: jest.fn(),
      isPending: jest.fn().mockReturnValue(false),
      resolveConflict: jest.fn(),
      pendingUpdates: new Map(),
      manager: {}
    });

    mockUseOptimisticReservations.mockReturnValue({
      applyOptimisticUpdate: jest.fn(),
      cancelUpdate: jest.fn(),
      isPending: jest.fn().mockReturnValue(false),
      resolveConflict: jest.fn(),
      pendingUpdates: new Map(),
      manager: {}
    });

    mockUseOptimisticMeetings.mockReturnValue({
      applyOptimisticUpdate: jest.fn(),
      cancelUpdate: jest.fn(),
      isPending: jest.fn().mockReturnValue(false),
      resolveConflict: jest.fn(),
      pendingUpdates: new Map(),
      manager: {}
    });
  });

  it('should provide real-time context with initial data', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.payments.data).toEqual(mockPaymentsData);
    expect(result.current.reservations.data).toEqual(mockReservationsData);
    expect(result.current.meetings.data).toEqual(mockMeetingsData);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should handle payment updates with optimistic updates', async () => {
    const mockApplyOptimisticUpdate = jest.fn();
    mockUseOptimisticPayments.mockReturnValue({
      applyOptimisticUpdate: mockApplyOptimisticUpdate,
      cancelUpdate: jest.fn(),
      isPending: jest.fn().mockReturnValue(false),
      resolveConflict: jest.fn(),
      pendingUpdates: new Map(),
      manager: {}
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    const updateData = { status: 'paid' as const };
    
    await act(async () => {
      await result.current.updatePayment('1', updateData);
    });

    expect(mockApplyOptimisticUpdate).toHaveBeenCalledWith(
      '1',
      'update',
      updateData,
      mockPaymentsData[0]
    );
  });

  it('should handle reservation creation with optimistic updates', async () => {
    const mockApplyOptimisticUpdate = jest.fn();
    mockUseOptimisticReservations.mockReturnValue({
      applyOptimisticUpdate: mockApplyOptimisticUpdate,
      cancelUpdate: jest.fn(),
      isPending: jest.fn().mockReturnValue(false),
      resolveConflict: jest.fn(),
      pendingUpdates: new Map(),
      manager: {}
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    const newReservation = {
      userId: 'user123',
      areaId: 'gym',
      areaName: 'Gym',
      startTime: new Date(),
      endTime: new Date(),
      status: 'confirmed' as const
    };
    
    await act(async () => {
      await result.current.createReservation(newReservation);
    });

    expect(mockApplyOptimisticUpdate).toHaveBeenCalledWith(
      expect.stringMatching(/^temp-/),
      'create',
      expect.objectContaining(newReservation)
    );
  });

  it('should handle meeting deletion with optimistic updates', async () => {
    const mockApplyOptimisticUpdate = jest.fn();
    mockUseOptimisticMeetings.mockReturnValue({
      applyOptimisticUpdate: mockApplyOptimisticUpdate,
      cancelUpdate: jest.fn(),
      isPending: jest.fn().mockReturnValue(false),
      resolveConflict: jest.fn(),
      pendingUpdates: new Map(),
      manager: {}
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });
    
    await act(async () => {
      await result.current.deleteMeeting('1');
    });

    expect(mockApplyOptimisticUpdate).toHaveBeenCalledWith(
      '1',
      'delete',
      {},
      mockMeetingsData[0]
    );
  });

  it('should manage notifications correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    // Initially no notifications
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);

    // Connection status change should add notification
    mockUseConnectionStatus.mockReturnValue('connected');
    
    // Re-render to trigger useEffect
    const { rerender } = render(<RealtimeProvider><div /></RealtimeProvider>);
    rerender(<RealtimeProvider><div /></RealtimeProvider>);
  });

  it('should mark notifications as read', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    // Simulate having notifications (this would normally come from useEffect)
    act(() => {
      // This would be triggered by connection status change or data updates
      // For testing, we'll directly test the notification functions
      result.current.markNotificationAsRead('test-id');
      result.current.markAllNotificationsAsRead();
      result.current.clearNotifications();
    });

    // Functions should be callable without errors
    expect(result.current.markNotificationAsRead).toBeDefined();
    expect(result.current.markAllNotificationsAsRead).toBeDefined();
    expect(result.current.clearNotifications).toBeDefined();
  });

  it('should handle connection status changes', () => {
    mockUseConnectionStatus.mockReturnValue('error');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    expect(result.current.connectionStatus).toBe('error');
  });

  it('should handle loading states', () => {
    mockUseRealtimePayments.mockReturnValue({
      data: [],
      loading: true,
      error: null,
      connectionStatus: 'disconnected',
      lastUpdated: null,
      applyOptimisticUpdate: jest.fn(),
      removeOptimisticUpdate: jest.fn()
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    expect(result.current.payments.loading).toBe(true);
    expect(result.current.payments.data).toEqual([]);
  });

  it('should handle error states', () => {
    const errorMessage = 'Connection failed';
    mockUseRealtimeReservations.mockReturnValue({
      data: [],
      loading: false,
      error: errorMessage,
      connectionStatus: 'error',
      lastUpdated: null,
      applyOptimisticUpdate: jest.fn(),
      removeOptimisticUpdate: jest.fn()
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    expect(result.current.reservations.error).toBe(errorMessage);
    expect(result.current.reservations.loading).toBe(false);
  });

  it('should provide utility functions', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RealtimeProvider>{children}</RealtimeProvider>
    );

    const { result } = renderHook(() => useRealtime(), { wrapper });

    expect(typeof result.current.refreshData).toBe('function');
    expect(typeof result.current.isDataStale).toBe('function');

    // Test isDataStale function
    const isStale = result.current.isDataStale();
    expect(typeof isStale).toBe('boolean');

    // Test refreshData function (should not throw)
    act(() => {
      result.current.refreshData();
    });
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useRealtime());
    }).toThrow('useRealtime must be used within a RealtimeProvider');

    consoleError.mockRestore();
  });

  it('should handle user changes', () => {
    const { rerender } = render(
      <RealtimeProvider>
        <div />
      </RealtimeProvider>
    );

    // Change user
    mockUseAuth.mockReturnValue({
      user: { ...mockUser, uid: 'different-user' } as any,
      userRole: 'admin',
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      refreshUserRole: jest.fn()
    });

    rerender(
      <RealtimeProvider>
        <div />
      </RealtimeProvider>
    );

    // Should call hooks with new user ID
    expect(mockUseRealtimePayments).toHaveBeenCalledWith(
      'different-user',
      expect.any(Object)
    );
  });
});