import { useState, useCallback, useRef, useEffect } from 'react';
import { doc, updateDoc, addDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../config/firebase.config';

// Optimistic update types
export type OptimisticAction = 'create' | 'update' | 'delete';

export interface OptimisticUpdate<T> {
  id: string;
  action: OptimisticAction;
  data: Partial<T>;
  timestamp: Date;
  retryCount: number;
  originalData?: T;
}

export interface OptimisticUpdateOptions {
  maxRetries?: number;
  retryDelay?: number;
  conflictResolution?: 'server-wins' | 'client-wins' | 'merge';
  onSuccess?: (id: string, data: any) => void;
  onError?: (id: string, error: Error) => void;
  onConflict?: (id: string, serverData: any, clientData: any) => any;
}

// Optimistic updates manager
export class OptimisticUpdatesManager<T> {
  private pendingUpdates = new Map<string, OptimisticUpdate<T>>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private options: Required<OptimisticUpdateOptions>;

  constructor(
    private collectionName: string,
    options: OptimisticUpdateOptions = {}
  ) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      conflictResolution: 'server-wins',
      onSuccess: () => {},
      onError: () => {},
      onConflict: (id, serverData, clientData) => serverData,
      ...options
    };
  }

  // Apply optimistic update
  applyUpdate(id: string, action: OptimisticAction, data: Partial<T>, originalData?: T): void {
    const update: OptimisticUpdate<T> = {
      id,
      action,
      data,
      timestamp: new Date(),
      retryCount: 0,
      originalData
    };

    this.pendingUpdates.set(id, update);
    this.executeUpdate(update);
  }

  // Execute the actual Firestore operation
  private async executeUpdate(update: OptimisticUpdate<T>): Promise<void> {
    try {
      const { id, action, data } = update;

      switch (action) {
        case 'create':
          const docRef = await addDoc(collection(firestore(), this.collectionName), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          this.handleSuccess(id, { id: docRef.id, ...data });
          break;

        case 'update':
          await updateDoc(doc(firestore(), this.collectionName, id), {
            ...data,
            updatedAt: serverTimestamp()
          });
          this.handleSuccess(id, data);
          break;

        case 'delete':
          await deleteDoc(doc(firestore(), this.collectionName, id));
          this.handleSuccess(id, null);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.handleError(update, error as Error);
    }
  }

  // Handle successful update
  private handleSuccess(id: string, data: any): void {
    this.pendingUpdates.delete(id);
    this.clearRetryTimeout(id);
    this.options.onSuccess(id, data);
  }

  // Handle update error
  private handleError(update: OptimisticUpdate<T>, error: Error): void {
    const { id } = update;

    if (update.retryCount < this.options.maxRetries) {
      update.retryCount++;
      const delay = this.options.retryDelay * Math.pow(2, update.retryCount - 1); // Exponential backoff

      const timeout = setTimeout(() => {
        this.executeUpdate(update);
      }, delay);

      this.retryTimeouts.set(id, timeout);
    } else {
      this.pendingUpdates.delete(id);
      this.clearRetryTimeout(id);
      this.options.onError(id, error);
    }
  }

  // Handle conflict resolution
  resolveConflict(id: string, serverData: T, clientData: Partial<T>): T {
    const { conflictResolution, onConflict } = this.options;

    switch (conflictResolution) {
      case 'server-wins':
        return serverData;
      
      case 'client-wins':
        return { ...serverData, ...clientData };
      
      case 'merge':
        return this.mergeData(serverData, clientData);
      
      default:
        return onConflict(id, serverData, clientData);
    }
  }

  // Merge server and client data intelligently
  private mergeData(serverData: T, clientData: Partial<T>): T {
    const merged = { ...serverData };

    // Merge non-conflicting fields
    Object.keys(clientData).forEach(key => {
      const serverValue = (serverData as any)[key];
      const clientValue = (clientData as any)[key];

      // If server value is newer (has updatedAt), keep server value
      if (key === 'updatedAt' && serverValue && clientValue) {
        const serverTime = new Date(serverValue);
        const clientTime = new Date(clientValue);
        (merged as any)[key] = serverTime > clientTime ? serverValue : clientValue;
      } else if (clientValue !== undefined) {
        (merged as any)[key] = clientValue;
      }
    });

    return merged;
  }

  // Clear retry timeout
  private clearRetryTimeout(id: string): void {
    const timeout = this.retryTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(id);
    }
  }

  // Get pending updates
  getPendingUpdates(): Map<string, OptimisticUpdate<T>> {
    return new Map(this.pendingUpdates);
  }

  // Check if update is pending
  isPending(id: string): boolean {
    return this.pendingUpdates.has(id);
  }

  // Cancel pending update
  cancelUpdate(id: string): void {
    this.pendingUpdates.delete(id);
    this.clearRetryTimeout(id);
  }

  // Clear all pending updates
  clearAll(): void {
    this.pendingUpdates.clear();
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
  }

  // Cleanup
  destroy(): void {
    this.clearAll();
  }
}

// Hook for optimistic updates
export const useOptimisticUpdates = <T>(
  collectionName: string,
  options: OptimisticUpdateOptions = {}
) => {
  const managerRef = useRef<OptimisticUpdatesManager<T>>();
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, OptimisticUpdate<T>>>(new Map());

  // Initialize manager
  useEffect(() => {
    managerRef.current = new OptimisticUpdatesManager<T>(collectionName, {
      ...options,
      onSuccess: (id, data) => {
        setPendingUpdates(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
        options.onSuccess?.(id, data);
      },
      onError: (id, error) => {
        setPendingUpdates(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
        options.onError?.(id, error);
      }
    });

    return () => {
      managerRef.current?.destroy();
    };
  }, [collectionName]);

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback((
    id: string, 
    action: OptimisticAction, 
    data: Partial<T>, 
    originalData?: T
  ) => {
    if (managerRef.current) {
      managerRef.current.applyUpdate(id, action, data, originalData);
      setPendingUpdates(managerRef.current.getPendingUpdates());
    }
  }, []);

  // Cancel update
  const cancelUpdate = useCallback((id: string) => {
    if (managerRef.current) {
      managerRef.current.cancelUpdate(id);
      setPendingUpdates(managerRef.current.getPendingUpdates());
    }
  }, []);

  // Check if pending
  const isPending = useCallback((id: string) => {
    return managerRef.current?.isPending(id) || false;
  }, []);

  // Resolve conflict
  const resolveConflict = useCallback((id: string, serverData: T, clientData: Partial<T>) => {
    return managerRef.current?.resolveConflict(id, serverData, clientData) || serverData;
  }, []);

  return {
    applyOptimisticUpdate,
    cancelUpdate,
    isPending,
    resolveConflict,
    pendingUpdates,
    manager: managerRef.current
  };
};

// Specific hooks for each entity type
export const useOptimisticPayments = (options: OptimisticUpdateOptions = {}) => {
  return useOptimisticUpdates('payments', options);
};

export const useOptimisticReservations = (options: OptimisticUpdateOptions = {}) => {
  return useOptimisticUpdates('reservations', options);
};

export const useOptimisticMeetings = (options: OptimisticUpdateOptions = {}) => {
  return useOptimisticUpdates('meetings', options);
};