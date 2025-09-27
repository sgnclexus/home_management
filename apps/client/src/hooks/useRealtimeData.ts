import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  DocumentSnapshot, 
  QuerySnapshot, 
  FirestoreError,
  where,
  orderBy,
  limit,
  Unsubscribe,
  getDoc
} from 'firebase/firestore';
import { firestore } from '../config/firebase.config';
import { Payment, Reservation, Meeting } from '@home-management/types';

// Connection status type
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'error';

// Real-time data state interface
interface RealtimeDataState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  lastUpdated: Date | null;
}

// Real-time options interface
interface RealtimeOptions {
  enableOptimisticUpdates?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

// Connection monitor hook
export const useConnectionStatus = (): ConnectionStatus => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const checkConnection = useCallback(async () => {
    try {
      // Simple connectivity test using a lightweight Firestore operation
      const testDoc = doc(firestore(), 'connection-test', 'test');
      await getDoc(testDoc);
      setStatus('connected');
      retryCountRef.current = 0;
    } catch (error) {
      console.warn('Connection check failed:', error);
      setStatus('error');
      
      // Retry logic
      if (retryCountRef.current < maxRetries) {
        setStatus('reconnecting');
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          checkConnection();
        }, 2000 * retryCountRef.current); // Exponential backoff
      }
    }
  }, []);

  useEffect(() => {
    // Initial connection check
    checkConnection();

    // Set up periodic connection monitoring
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds

    return () => {
      clearInterval(interval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [checkConnection]);

  return status;
};

// Generic real-time data hook
const useRealtimeCollection = <T>(
  collectionName: string,
  queryConstraints: any[] = [],
  options: RealtimeOptions = {}
): RealtimeDataState<T> => {
  const [state, setState] = useState<RealtimeDataState<T>>({
    data: [],
    loading: true,
    error: null,
    connectionStatus: 'disconnected',
    lastUpdated: null
  });

  const connectionStatus = useConnectionStatus();
  const unsubscribeRef = useRef<Unsubscribe>();
  const optimisticUpdatesRef = useRef<Map<string, T>>(new Map());

  const {
    enableOptimisticUpdates = false,
    retryOnError = true,
    retryDelay = 2000
  } = options;

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback((id: string, data: T) => {
    if (enableOptimisticUpdates) {
      optimisticUpdatesRef.current.set(id, data);
      setState(prev => ({
        ...prev,
        data: prev.data.map(item => 
          (item as any).id === id ? { ...item, ...data } : item
        )
      }));
    }
  }, [enableOptimisticUpdates]);

  // Remove optimistic update
  const removeOptimisticUpdate = useCallback((id: string) => {
    optimisticUpdatesRef.current.delete(id);
  }, []);

  // Set up real-time listener
  const setupListener = useCallback(() => {
    try {
      const collectionRef = collection(firestore(), collectionName);
      const q = queryConstraints.length > 0 
        ? query(collectionRef, ...queryConstraints)
        : collectionRef;

      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];

          // Merge with optimistic updates
          const mergedData = enableOptimisticUpdates
            ? data.map(item => {
                const optimisticUpdate = optimisticUpdatesRef.current.get((item as any).id);
                return optimisticUpdate ? { ...item, ...optimisticUpdate } : item;
              })
            : data;

          setState(prev => ({
            ...prev,
            data: mergedData,
            loading: false,
            error: null,
            connectionStatus: 'connected',
            lastUpdated: new Date()
          }));
        },
        (error: FirestoreError) => {
          console.error(`Real-time listener error for ${collectionName}:`, error);
          setState(prev => ({
            ...prev,
            loading: false,
            error: error.message,
            connectionStatus: 'error'
          }));

          if (retryOnError) {
            setTimeout(() => {
              setupListener();
            }, retryDelay);
          }
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error(`Failed to setup listener for ${collectionName}:`, error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionStatus: 'error'
      }));
    }
  }, [collectionName, queryConstraints, retryOnError, retryDelay, enableOptimisticUpdates]);

  useEffect(() => {
    setupListener();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [setupListener]);

  // Update connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      connectionStatus
    }));
  }, [connectionStatus]);

  return {
    ...state,
    connectionStatus
  };
};

// Payments real-time hook
export const useRealtimePayments = (
  userId?: string,
  options: RealtimeOptions = {}
): RealtimeDataState<Payment> & {
  applyOptimisticUpdate: (id: string, data: Partial<Payment>) => void;
  removeOptimisticUpdate: (id: string) => void;
} => {
  const queryConstraints = userId 
    ? [where('userId', '==', userId), orderBy('createdAt', 'desc')]
    : [orderBy('createdAt', 'desc'), limit(100)];

  const state = useRealtimeCollection<Payment>('payments', queryConstraints, options);
  
  const applyOptimisticUpdate = useCallback((id: string, data: Partial<Payment>) => {
    // Implementation will be added in the optimistic updates section
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    // Implementation will be added in the optimistic updates section
  }, []);

  return {
    ...state,
    applyOptimisticUpdate,
    removeOptimisticUpdate
  };
};

// Reservations real-time hook
export const useRealtimeReservations = (
  userId?: string,
  options: RealtimeOptions = {}
): RealtimeDataState<Reservation> & {
  applyOptimisticUpdate: (id: string, data: Partial<Reservation>) => void;
  removeOptimisticUpdate: (id: string) => void;
} => {
  const queryConstraints = userId 
    ? [where('userId', '==', userId), orderBy('startTime', 'asc')]
    : [orderBy('startTime', 'asc'), limit(100)];

  const state = useRealtimeCollection<Reservation>('reservations', queryConstraints, options);
  
  const applyOptimisticUpdate = useCallback((id: string, data: Partial<Reservation>) => {
    // Implementation will be added in the optimistic updates section
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    // Implementation will be added in the optimistic updates section
  }, []);

  return {
    ...state,
    applyOptimisticUpdate,
    removeOptimisticUpdate
  };
};

// Meetings real-time hook
export const useRealtimeMeetings = (
  options: RealtimeOptions = {}
): RealtimeDataState<Meeting> & {
  applyOptimisticUpdate: (id: string, data: Partial<Meeting>) => void;
  removeOptimisticUpdate: (id: string) => void;
} => {
  const queryConstraints = [orderBy('scheduledDate', 'desc'), limit(50)];

  const state = useRealtimeCollection<Meeting>('meetings', queryConstraints, options);
  
  const applyOptimisticUpdate = useCallback((id: string, data: Partial<Meeting>) => {
    // Implementation will be added in the optimistic updates section
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    // Implementation will be added in the optimistic updates section
  }, []);

  return {
    ...state,
    applyOptimisticUpdate,
    removeOptimisticUpdate
  };
};

// Single document real-time hook
export const useRealtimeDocument = <T>(
  collectionName: string,
  documentId: string,
  options: RealtimeOptions = {}
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  lastUpdated: Date | null;
} => {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
    connectionStatus: ConnectionStatus;
    lastUpdated: Date | null;
  }>({
    data: null,
    loading: true,
    error: null,
    connectionStatus: 'disconnected',
    lastUpdated: null
  });

  const connectionStatus = useConnectionStatus();
  const unsubscribeRef = useRef<Unsubscribe>();

  const {
    retryOnError = true,
    retryDelay = 2000
  } = options;

  const setupListener = useCallback(() => {
    try {
      const docRef = doc(firestore(), collectionName, documentId);

      const unsubscribe = onSnapshot(
        docRef,
        (snapshot: DocumentSnapshot) => {
          if (snapshot.exists()) {
            const data = {
              id: snapshot.id,
              ...snapshot.data()
            } as T;

            setState(prev => ({
              ...prev,
              data,
              loading: false,
              error: null,
              connectionStatus: 'connected',
              lastUpdated: new Date()
            }));
          } else {
            setState(prev => ({
              ...prev,
              data: null,
              loading: false,
              error: 'Document not found',
              connectionStatus: 'connected',
              lastUpdated: new Date()
            }));
          }
        },
        (error: FirestoreError) => {
          console.error(`Real-time document listener error for ${collectionName}/${documentId}:`, error);
          setState(prev => ({
            ...prev,
            loading: false,
            error: error.message,
            connectionStatus: 'error'
          }));

          if (retryOnError) {
            setTimeout(() => {
              setupListener();
            }, retryDelay);
          }
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error(`Failed to setup document listener for ${collectionName}/${documentId}:`, error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionStatus: 'error'
      }));
    }
  }, [collectionName, documentId, retryOnError, retryDelay]);

  useEffect(() => {
    if (documentId) {
      setupListener();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [setupListener, documentId]);

  // Update connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      connectionStatus
    }));
  }, [connectionStatus]);

  return state;
};