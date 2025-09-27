import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useOptimisticUpdates, 
  OptimisticUpdatesManager,
  useOptimisticPayments,
  useOptimisticReservations,
  useOptimisticMeetings
} from '../useOptimisticUpdates';

// Mock Firebase
jest.mock('../../config/firebase.config', () => ({
  firestore: jest.fn()
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' }))
}));

const mockUpdateDoc = require('firebase/firestore').updateDoc as jest.MockedFunction<any>;
const mockAddDoc = require('firebase/firestore').addDoc as jest.MockedFunction<any>;
const mockDeleteDoc = require('firebase/firestore').deleteDoc as jest.MockedFunction<any>;
const mockCollection = require('firebase/firestore').collection as jest.MockedFunction<any>;
const mockDoc = require('firebase/firestore').doc as jest.MockedFunction<any>;

describe('OptimisticUpdatesManager', () => {
  let manager: OptimisticUpdatesManager<any>;
  let onSuccessMock: jest.Mock;
  let onErrorMock: jest.Mock;
  let onConflictMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onSuccessMock = jest.fn();
    onErrorMock = jest.fn();
    onConflictMock = jest.fn();

    manager = new OptimisticUpdatesManager('test-collection', {
      maxRetries: 2,
      retryDelay: 100,
      conflictResolution: 'server-wins',
      onSuccess: onSuccessMock,
      onError: onErrorMock,
      onConflict: onConflictMock
    });

    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('create operations', () => {
    it('should handle successful create operation', async () => {
      const mockDocRef = { id: 'new-doc-id' };
      mockAddDoc.mockResolvedValue(mockDocRef);

      const testData = { name: 'Test Item', value: 123 };
      
      manager.applyUpdate('temp-id', 'create', testData);

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            ...testData,
            createdAt: expect.anything(),
            updatedAt: expect.anything()
          })
        );
        expect(onSuccessMock).toHaveBeenCalledWith('temp-id', {
          id: 'new-doc-id',
          ...testData
        });
      });
    });

    it('should handle failed create operation with retries', async () => {
      const error = new Error('Network error');
      mockAddDoc
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ id: 'new-doc-id' });

      const testData = { name: 'Test Item' };
      
      manager.applyUpdate('temp-id', 'create', testData);

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledTimes(3);
        expect(onSuccessMock).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should call onError after max retries exceeded', async () => {
      const error = new Error('Persistent error');
      mockAddDoc.mockRejectedValue(error);

      const testData = { name: 'Test Item' };
      
      manager.applyUpdate('temp-id', 'create', testData);

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledTimes(3); // Initial + 2 retries
        expect(onErrorMock).toHaveBeenCalledWith('temp-id', error);
      }, { timeout: 1000 });
    });
  });

  describe('update operations', () => {
    it('should handle successful update operation', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const testData = { name: 'Updated Item' };
      
      manager.applyUpdate('existing-id', 'update', testData);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            ...testData,
            updatedAt: expect.anything()
          })
        );
        expect(onSuccessMock).toHaveBeenCalledWith('existing-id', testData);
      });
    });

    it('should handle failed update operation', async () => {
      const error = new Error('Update failed');
      mockUpdateDoc.mockRejectedValue(error);

      const testData = { name: 'Updated Item' };
      
      manager.applyUpdate('existing-id', 'update', testData);

      await waitFor(() => {
        expect(onErrorMock).toHaveBeenCalledWith('existing-id', error);
      }, { timeout: 1000 });
    });
  });

  describe('delete operations', () => {
    it('should handle successful delete operation', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);
      
      manager.applyUpdate('existing-id', 'delete', {});

      await waitFor(() => {
        expect(mockDeleteDoc).toHaveBeenCalledWith(expect.anything());
        expect(onSuccessMock).toHaveBeenCalledWith('existing-id', null);
      });
    });

    it('should handle failed delete operation', async () => {
      const error = new Error('Delete failed');
      mockDeleteDoc.mockRejectedValue(error);
      
      manager.applyUpdate('existing-id', 'delete', {});

      await waitFor(() => {
        expect(onErrorMock).toHaveBeenCalledWith('existing-id', error);
      }, { timeout: 1000 });
    });
  });

  describe('conflict resolution', () => {
    it('should resolve conflicts with server-wins strategy', () => {
      const serverData = { id: '1', name: 'Server Name', version: 2 };
      const clientData = { name: 'Client Name', version: 1 };

      const result = manager.resolveConflict('1', serverData, clientData);

      expect(result).toEqual(serverData);
    });

    it('should resolve conflicts with client-wins strategy', () => {
      const clientWinsManager = new OptimisticUpdatesManager('test', {
        conflictResolution: 'client-wins'
      });

      const serverData = { id: '1', name: 'Server Name', version: 2 };
      const clientData = { name: 'Client Name', version: 1 };

      const result = clientWinsManager.resolveConflict('1', serverData, clientData);

      expect(result).toEqual({ ...serverData, ...clientData });
      
      clientWinsManager.destroy();
    });

    it('should resolve conflicts with merge strategy', () => {
      const mergeManager = new OptimisticUpdatesManager('test', {
        conflictResolution: 'merge'
      });

      const serverData = { 
        id: '1', 
        name: 'Server Name', 
        updatedAt: new Date('2023-01-02')
      };
      const clientData = { 
        name: 'Client Name', 
        updatedAt: new Date('2023-01-01')
      };

      const result = mergeManager.resolveConflict('1', serverData, clientData);

      // Should keep server's updatedAt since it's newer
      expect(result.updatedAt).toEqual(serverData.updatedAt);
      expect(result.name).toBe('Client Name'); // Client data should be merged
      
      mergeManager.destroy();
    });

    it('should use custom conflict resolution function', () => {
      const customResolver = jest.fn().mockReturnValue({ custom: 'resolution' });
      const customManager = new OptimisticUpdatesManager('test', {
        conflictResolution: 'custom' as any, // Use a custom value to trigger default case
        onConflict: customResolver
      });

      const serverData = { id: '1', name: 'Server' };
      const clientData = { name: 'Client' };

      const result = customManager.resolveConflict('1', serverData, clientData);

      expect(customResolver).toHaveBeenCalledWith('1', serverData, clientData);
      expect(result).toEqual({ custom: 'resolution' });
      
      customManager.destroy();
    });
  });

  describe('pending updates management', () => {
    it('should track pending updates', () => {
      mockAddDoc.mockImplementation(() => new Promise(() => {})); // Never resolves

      manager.applyUpdate('test-id', 'create', { name: 'Test' });

      expect(manager.isPending('test-id')).toBe(true);
      expect(manager.getPendingUpdates().size).toBe(1);
    });

    it('should remove pending updates on success', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-id' });

      manager.applyUpdate('test-id', 'create', { name: 'Test' });

      await waitFor(() => {
        expect(manager.isPending('test-id')).toBe(false);
        expect(manager.getPendingUpdates().size).toBe(0);
      });
    });

    it('should cancel pending updates', () => {
      mockAddDoc.mockImplementation(() => new Promise(() => {})); // Never resolves

      manager.applyUpdate('test-id', 'create', { name: 'Test' });
      expect(manager.isPending('test-id')).toBe(true);

      manager.cancelUpdate('test-id');
      expect(manager.isPending('test-id')).toBe(false);
    });

    it('should clear all pending updates', () => {
      mockAddDoc.mockImplementation(() => new Promise(() => {})); // Never resolves

      manager.applyUpdate('test-1', 'create', { name: 'Test 1' });
      manager.applyUpdate('test-2', 'create', { name: 'Test 2' });
      
      expect(manager.getPendingUpdates().size).toBe(2);

      manager.clearAll();
      expect(manager.getPendingUpdates().size).toBe(0);
    });
  });
});

describe('useOptimisticUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty pending updates', () => {
    const { result } = renderHook(() => 
      useOptimisticUpdates('test-collection')
    );

    expect(result.current.pendingUpdates.size).toBe(0);
  });

  it('should apply optimistic updates', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new-id' });

    const { result } = renderHook(() => 
      useOptimisticUpdates('test-collection')
    );

    act(() => {
      result.current.applyOptimisticUpdate('test-id', 'create', { name: 'Test' });
    });

    expect(result.current.isPending('test-id')).toBe(true);

    await waitFor(() => {
      expect(result.current.isPending('test-id')).toBe(false);
    });
  });

  it('should handle success and error callbacks', async () => {
    const onSuccess = jest.fn();
    const onError = jest.fn();
    
    mockAddDoc.mockRejectedValue(new Error('Test error'));

    const { result } = renderHook(() => 
      useOptimisticUpdates('test-collection', { onSuccess, onError, maxRetries: 0 })
    );

    act(() => {
      result.current.applyOptimisticUpdate('test-id', 'create', { name: 'Test' });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('test-id', expect.any(Error));
    });
  });

  it('should cancel updates', () => {
    mockAddDoc.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => 
      useOptimisticUpdates('test-collection')
    );

    act(() => {
      result.current.applyOptimisticUpdate('test-id', 'create', { name: 'Test' });
    });

    expect(result.current.isPending('test-id')).toBe(true);

    act(() => {
      result.current.cancelUpdate('test-id');
    });

    expect(result.current.isPending('test-id')).toBe(false);
  });
});

describe('Entity-specific hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create payments optimistic updates hook', () => {
    const { result } = renderHook(() => useOptimisticPayments());

    expect(result.current.applyOptimisticUpdate).toBeDefined();
    expect(result.current.cancelUpdate).toBeDefined();
    expect(result.current.isPending).toBeDefined();
  });

  it('should create reservations optimistic updates hook', () => {
    const { result } = renderHook(() => useOptimisticReservations());

    expect(result.current.applyOptimisticUpdate).toBeDefined();
    expect(result.current.cancelUpdate).toBeDefined();
    expect(result.current.isPending).toBeDefined();
  });

  it('should create meetings optimistic updates hook', () => {
    const { result } = renderHook(() => useOptimisticMeetings());

    expect(result.current.applyOptimisticUpdate).toBeDefined();
    expect(result.current.cancelUpdate).toBeDefined();
    expect(result.current.isPending).toBeDefined();
  });
});