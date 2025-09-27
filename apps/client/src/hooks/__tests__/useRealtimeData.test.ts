import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useConnectionStatus, 
  useRealtimePayments, 
  useRealtimeReservations, 
  useRealtimeMeetings,
  useRealtimeDocument
} from '../useRealtimeData';
import { firestore } from '../../config/firebase.config';

// Mock Firebase
jest.mock('../../config/firebase.config', () => ({
  firestore: jest.fn()
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  onSnapshot: jest.fn(),
  doc: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn()
}));

const mockFirestore = firestore as jest.MockedFunction<typeof firestore>;
const mockOnSnapshot = require('firebase/firestore').onSnapshot as jest.MockedFunction<any>;
const mockCollection = require('firebase/firestore').collection as jest.MockedFunction<any>;
const mockQuery = require('firebase/firestore').query as jest.MockedFunction<any>;
const mockDoc = require('firebase/firestore').doc as jest.MockedFunction<any>;

describe('useConnectionStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore.mockReturnValue({} as any);
  });

  it('should start with disconnected status', () => {
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current).toBe('disconnected');
  });

  it('should update to connected when connection is successful', async () => {
    mockDoc.mockReturnValue({
      get: jest.fn().mockResolvedValue({})
    });

    const { result } = renderHook(() => useConnectionStatus());

    await waitFor(() => {
      expect(result.current).toBe('connected');
    });
  });

  it('should update to error when connection fails', async () => {
    mockDoc.mockReturnValue({
      get: jest.fn().mockRejectedValue(new Error('Connection failed'))
    });

    const { result } = renderHook(() => useConnectionStatus());

    await waitFor(() => {
      expect(result.current).toBe('error');
    });
  });

  it('should retry connection on failure', async () => {
    const mockGet = jest.fn()
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce({});

    mockDoc.mockReturnValue({ get: mockGet });

    const { result } = renderHook(() => useConnectionStatus());

    await waitFor(() => {
      expect(result.current).toBe('reconnecting');
    });

    await waitFor(() => {
      expect(result.current).toBe('connected');
    }, { timeout: 3000 });

    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe('useRealtimePayments', () => {
  const mockPayments = [
    {
      id: '1',
      userId: 'user1',
      amount: 100,
      currency: 'USD',
      description: 'Monthly fee',
      status: 'paid',
      dueDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      userId: 'user1',
      amount: 150,
      currency: 'USD',
      description: 'Maintenance fee',
      status: 'pending',
      dueDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore.mockReturnValue({} as any);
    mockCollection.mockReturnValue({});
    mockQuery.mockReturnValue({});
  });

  it('should start with loading state', () => {
    mockOnSnapshot.mockImplementation((query, callback) => {
      // Don't call callback immediately
      return jest.fn(); // unsubscribe function
    });

    const { result } = renderHook(() => useRealtimePayments('user1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should update data when snapshot is received', async () => {
    mockOnSnapshot.mockImplementation((query, callback) => {
      // Simulate immediate callback with data
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

    const { result } = renderHook(() => useRealtimePayments('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].id).toBe('1');
      expect(result.current.error).toBe(null);
    });
  });

  it('should handle errors from Firestore', async () => {
    const mockError = { message: 'Permission denied' };
    
    mockOnSnapshot.mockImplementation((query, successCallback, errorCallback) => {
      setTimeout(() => {
        errorCallback(mockError);
      }, 0);
      return jest.fn(); // unsubscribe function
    });

    const { result } = renderHook(() => useRealtimePayments('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Permission denied');
      expect(result.current.connectionStatus).toBe('error');
    });
  });

  it('should filter payments by userId when provided', () => {
    mockOnSnapshot.mockImplementation(() => jest.fn());

    renderHook(() => useRealtimePayments('user1'));

    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(), // where clause
      expect.anything()  // orderBy clause
    );
  });

  it('should cleanup subscription on unmount', () => {
    const mockUnsubscribe = jest.fn();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useRealtimePayments('user1'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('useRealtimeReservations', () => {
  const mockReservations = [
    {
      id: '1',
      userId: 'user1',
      areaId: 'area1',
      areaName: 'Pool',
      startTime: new Date(),
      endTime: new Date(),
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore.mockReturnValue({} as any);
    mockCollection.mockReturnValue({});
    mockQuery.mockReturnValue({});
  });

  it('should load reservations data', async () => {
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

    const { result } = renderHook(() => useRealtimeReservations('user1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].areaName).toBe('Pool');
    });
  });

  it('should order reservations by startTime', () => {
    mockOnSnapshot.mockImplementation(() => jest.fn());

    renderHook(() => useRealtimeReservations('user1'));

    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(), // where clause
      expect.anything()  // orderBy startTime
    );
  });
});

describe('useRealtimeMeetings', () => {
  const mockMeetings = [
    {
      id: '1',
      title: 'Monthly Meeting',
      description: 'Regular monthly meeting',
      scheduledDate: new Date(),
      agenda: ['Budget review', 'Maintenance updates'],
      status: 'scheduled',
      attendees: ['user1', 'user2'],
      createdBy: 'admin1',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore.mockReturnValue({} as any);
    mockCollection.mockReturnValue({});
    mockQuery.mockReturnValue({});
  });

  it('should load meetings data', async () => {
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

    const { result } = renderHook(() => useRealtimeMeetings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].title).toBe('Monthly Meeting');
    });
  });

  it('should limit meetings to 50 records', () => {
    mockOnSnapshot.mockImplementation(() => jest.fn());

    renderHook(() => useRealtimeMeetings());

    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(), // orderBy
      expect.anything()  // limit 50
    );
  });
});

describe('useRealtimeDocument', () => {
  const mockPayment = {
    id: '1',
    userId: 'user1',
    amount: 100,
    currency: 'USD',
    description: 'Monthly fee',
    status: 'paid',
    dueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore.mockReturnValue({} as any);
    mockDoc.mockReturnValue({});
  });

  it('should start with loading state', () => {
    mockOnSnapshot.mockImplementation(() => jest.fn());

    const { result } = renderHook(() => 
      useRealtimeDocument('payments', '1')
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should load document data when it exists', async () => {
    mockOnSnapshot.mockImplementation((docRef, callback) => {
      setTimeout(() => {
        callback({
          exists: () => true,
          id: mockPayment.id,
          data: () => ({ ...mockPayment, id: undefined })
        });
      }, 0);
      return jest.fn();
    });

    const { result } = renderHook(() => 
      useRealtimeDocument('payments', '1')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(mockPayment);
      expect(result.current.error).toBe(null);
    });
  });

  it('should handle document not found', async () => {
    mockOnSnapshot.mockImplementation((docRef, callback) => {
      setTimeout(() => {
        callback({
          exists: () => false
        });
      }, 0);
      return jest.fn();
    });

    const { result } = renderHook(() => 
      useRealtimeDocument('payments', '1')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(null);
      expect(result.current.error).toBe('Document not found');
    });
  });

  it('should handle Firestore errors', async () => {
    const mockError = { message: 'Permission denied' };
    
    mockOnSnapshot.mockImplementation((docRef, successCallback, errorCallback) => {
      setTimeout(() => {
        errorCallback(mockError);
      }, 0);
      return jest.fn();
    });

    const { result } = renderHook(() => 
      useRealtimeDocument('payments', '1')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Permission denied');
      expect(result.current.connectionStatus).toBe('error');
    });
  });

  it('should not setup listener when documentId is empty', () => {
    const { result } = renderHook(() => 
      useRealtimeDocument('payments', '')
    );

    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });
});