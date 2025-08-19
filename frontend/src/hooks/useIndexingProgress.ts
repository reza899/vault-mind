import { useState, useEffect, useCallback, useRef } from 'react';
import useCollectionWebSocket from './useCollectionWebSocket';

interface IndexingProgressData {
  progress_percentage: number;
  current_file?: string;
  files_processed: number;
  total_files: number;
  documents_created: number;
  chunks_created: number;
  processing_rate?: number; // files per second
  eta_seconds?: number;
  errors_count: number;
  last_error?: string | null;
  status: 'indexing' | 'paused' | 'completed' | 'error' | 'cancelled' | 'created';
}

interface IndexingProgressState {
  isActive: boolean;
  isConnected: boolean;
  progressData: IndexingProgressData | null;
  error: string | null;
  lastUpdated: Date | null;
}

interface IndexingProgressActions {
  startMonitoring: (collectionName: string) => void;
  stopMonitoring: () => void;
  pauseIndexing: () => void;
  resumeIndexing: () => void;
  cancelIndexing: () => void;
}

const STORAGE_KEY_PREFIX = 'vault-mind-progress';

/**
 * Hook for monitoring indexing progress via WebSocket
 * Provides real-time updates with persistence and reconnection handling
 */
export const useIndexingProgress = (): [IndexingProgressState, IndexingProgressActions] => {
  const [state, setState] = useState<IndexingProgressState>({
    isActive: false,
    isConnected: false,
    progressData: null,
    error: null,
    lastUpdated: null,
  });

  const currentCollectionRef = useRef<string | null>(null);
  const storageKeyRef = useRef<string | null>(null);

  // WebSocket connection - fixed to prevent infinite loops
  const wsCallbacks = useMemo(() => ({
    onConnect: () => console.log('[useIndexingProgress] WebSocket connected'),
    onDisconnect: () => console.log('[useIndexingProgress] WebSocket disconnected'),
    onError: (error: string) => setState(prev => ({ ...prev, error })),
  }), []);

  const [wsState, wsActions] = useCollectionWebSocket({
    enabled: false, // Only enable when actively monitoring
    reconnectAttempts: 5,
    reconnectInterval: 2000,
    maxReconnectInterval: 10000,
    debug: false, // Disable debug to reduce log spam
    ...wsCallbacks,
  });

  // Load persisted progress data on mount
  useEffect(() => {
    const savedCollection = localStorage.getItem(`${STORAGE_KEY_PREFIX}-collection`);
    const savedProgress = localStorage.getItem(`${STORAGE_KEY_PREFIX}-data`);
    
    if (savedCollection && savedProgress) {
      try {
        const progressData = JSON.parse(savedProgress);
        
        // Only restore if the indexing was in progress
        if (['indexing', 'paused'].includes(progressData.status)) {
          setState(prev => ({
            ...prev,
            progressData,
            lastUpdated: new Date(),
          }));
          
          // Auto-reconnect to continue monitoring
          currentCollectionRef.current = savedCollection;
          storageKeyRef.current = `${STORAGE_KEY_PREFIX}-${savedCollection}`;
          
          console.log(`[useIndexingProgress] Restored progress for collection: ${savedCollection}`);
        }
      } catch (error) {
        console.error('[useIndexingProgress] Failed to restore progress data:', error);
        // Clear corrupted data
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}-collection`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}-data`);
      }
    }
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (!wsState.lastMessage || !currentCollectionRef.current) return;

    const message = wsState.lastMessage;
    
    switch (message.type) {
      case 'progress_update':
        if (message.collection_name === currentCollectionRef.current && message.data) {
          const progressData: IndexingProgressData = {
            progress_percentage: message.data.progress_percentage || 0,
            current_file: message.data.current_file,
            files_processed: message.data.files_processed || 0,
            total_files: message.data.total_files || 0,
            documents_created: message.data.documents_created || 0,
            chunks_created: message.data.chunks_created || 0,
            processing_rate: message.data.processing_rate,
            eta_seconds: message.data.eta_seconds,
            errors_count: message.data.errors_count || 0,
            last_error: message.data.last_error,
            status: message.data.status || 'indexing',
          };

          setState(prev => ({
            ...prev,
            progressData,
            lastUpdated: new Date(),
            error: null,
          }));

          // Persist progress data
          if (storageKeyRef.current) {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}-collection`, currentCollectionRef.current);
            localStorage.setItem(`${STORAGE_KEY_PREFIX}-data`, JSON.stringify(progressData));
          }

          console.log('[useIndexingProgress] Progress update:', progressData);
        }
        break;

      case 'status_change':
        if (message.collection_name === currentCollectionRef.current) {
          setState(prev => ({
            ...prev,
            progressData: prev.progressData ? {
              ...prev.progressData,
              status: message.status
            } : null,
            lastUpdated: new Date(),
          }));

          // If completed/cancelled/error, clean up storage after delay
          if (['completed', 'cancelled', 'error'].includes(message.status)) {
            setTimeout(() => {
              localStorage.removeItem(`${STORAGE_KEY_PREFIX}-collection`);
              localStorage.removeItem(`${STORAGE_KEY_PREFIX}-data`);
            }, 5000); // Keep for 5 seconds to show final status
          }

          console.log('[useIndexingProgress] Status change:', message.status);
        }
        break;

      case 'error':
        if (message.collection_name === currentCollectionRef.current) {
          setState(prev => ({
            ...prev,
            error: message.error || 'Unknown error occurred',
            lastUpdated: new Date(),
          }));

          console.error('[useIndexingProgress] Error:', message.error);
        }
        break;

      case 'connection_established':
        console.log('[useIndexingProgress] Connection established:', message);
        break;

      case 'operation_response':
        console.log('[useIndexingProgress] Operation response:', message);
        if (!message.success && message.error) {
          setState(prev => ({
            ...prev,
            error: message.error,
          }));
        }
        break;

      case 'heartbeat':
        // Connection is alive, no action needed
        break;

      default:
        console.log('[useIndexingProgress] Unknown message type:', message.type);
    }
  }, [wsState.lastMessage]);

  // Update connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isConnected: wsState.isConnected,
    }));
  }, [wsState.isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsActions.disconnect();
    };
  }, [wsActions]);

  const startMonitoring = useCallback((collectionName: string) => {
    // Stop any existing monitoring
    if (currentCollectionRef.current) {
      wsActions.disconnect();
    }

    currentCollectionRef.current = collectionName;
    storageKeyRef.current = `${STORAGE_KEY_PREFIX}-${collectionName}`;

    setState(prev => ({
      ...prev,
      isActive: true,
      error: null,
    }));

    // Connect to WebSocket for this collection
    console.log('[useIndexingProgress] Starting monitoring for collection:', collectionName);
    wsActions.connect(collectionName);
    
  }, [wsActions]);

  const stopMonitoring = useCallback(() => {
    if (currentCollectionRef.current) {
      console.log('[useIndexingProgress] Stopping monitoring for collection:', currentCollectionRef.current);
      
      wsActions.disconnect();
      currentCollectionRef.current = null;
      storageKeyRef.current = null;

      setState(prev => ({
        ...prev,
        isActive: false,
        isConnected: false,
      }));

      // Clean up storage
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}-collection`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}-data`);
    }
  }, [wsActions]);

  const pauseIndexing = useCallback(() => {
    if (currentCollectionRef.current && wsState.isConnected) {
      wsActions.pauseIndexing();
      console.log('[useIndexingProgress] Pausing indexing for:', currentCollectionRef.current);
    }
  }, [wsActions, wsState.isConnected]);

  const resumeIndexing = useCallback(() => {
    if (currentCollectionRef.current && wsState.isConnected) {
      wsActions.resumeIndexing();
      console.log('[useIndexingProgress] Resuming indexing for:', currentCollectionRef.current);
    }
  }, [wsActions, wsState.isConnected]);

  const cancelIndexing = useCallback(() => {
    if (currentCollectionRef.current && wsState.isConnected) {
      wsActions.cancelIndexing();
      console.log('[useIndexingProgress] Cancelling indexing for:', currentCollectionRef.current);
    }
  }, [wsActions, wsState.isConnected]);

  const actions: IndexingProgressActions = {
    startMonitoring,
    stopMonitoring,
    pauseIndexing,
    resumeIndexing,
    cancelIndexing,
  };

  return [state, actions];
};

export default useIndexingProgress;