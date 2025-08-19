import { useState, useEffect, useRef, useCallback } from 'react';

interface ProgressData {
  progress_percentage?: number;
  current_step?: string;
  documents_processed?: number;
  total_documents?: number;
  files_processed?: number;
  total_files?: number;
}

interface WebSocketMessage {
  type: 'progress_update' | 'status_change' | 'error' | 'heartbeat' | 'connection_established' | 'operation_response';
  collection_name?: string;
  timestamp: number;
  data?: ProgressData | Record<string, unknown>;
  status?: string;
  error?: string;
  details?: Record<string, unknown>;
}

interface UseCollectionWebSocketOptions {
  enabled?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectDecay?: number;
  debug?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

interface CollectionWebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  reconnectAttempt: number;
}

interface CollectionWebSocketActions {
  connect: (collectionName: string) => void;
  disconnect: () => void;
  sendMessage: (message: Record<string, unknown>) => void;
  pauseIndexing: () => void;
  resumeIndexing: () => void;
  cancelIndexing: () => void;
  getStatus: () => void;
}

/**
 * WebSocket hook specifically for collection progress monitoring
 * Connects to /ws/collections/{collection_name}/progress endpoint
 */
export const useCollectionWebSocket = (
  options: UseCollectionWebSocketOptions = {}
): [CollectionWebSocketState, CollectionWebSocketActions] => {
  const {
    enabled = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
    reconnectDecay = 1.5,
    debug = false,
    onConnect,
    onDisconnect,
    onError,
    onMessage
  } = options;

  const [state, setState] = useState<CollectionWebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    reconnectAttempt: 0
  });

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldConnectRef = useRef<boolean>(enabled);
  const reconnectAttemptsRef = useRef<number>(0);
  const currentCollectionRef = useRef<string | null>(null);

  const log = useCallback((message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[useCollectionWebSocket] ${message}`, ...args);
    }
  }, [debug]);

  const connect = useCallback((collectionName: string) => {
    if (!shouldConnectRef.current || !enabled) {
      log('Connection not enabled, skipping connect');
      return;
    }

    if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
      log('Already connecting, skipping duplicate connect attempt');
      return;
    }

    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      // If connecting to a different collection, close current connection
      if (currentCollectionRef.current !== collectionName) {
        log('Switching collections, closing current connection');
        websocketRef.current.close();
      } else {
        log('Already connected to same collection, skipping connect');
        return;
      }
    }

    currentCollectionRef.current = collectionName;
    const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
    const url = `${baseUrl}/api/ws/collections/${collectionName}/progress`;

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }));
      log('Connecting to:', url);

      const ws = new WebSocket(url);
      websocketRef.current = ws;

      ws.onopen = (_event) => {
        log('WebSocket connected for collection:', collectionName);
        reconnectAttemptsRef.current = 0;
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempt: 0
        }));
        onConnect?.();
      };

      ws.onclose = (event) => {
        log('WebSocket closed for collection:', collectionName, event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          error: event.reason || `Connection closed (${event.code})`
        }));
        
        websocketRef.current = null;
        onDisconnect?.();

        // Attempt reconnection if enabled and not a normal closure
        if (shouldConnectRef.current && event.code !== 1000 && reconnectAttemptsRef.current < reconnectAttempts) {
          scheduleReconnect(collectionName);
        }
      };

      ws.onerror = (event) => {
        log('WebSocket error for collection:', collectionName, event);
        const errorMsg = 'WebSocket connection error';
        setState(prev => ({
          ...prev,
          error: errorMsg,
          isConnecting: false
        }));
        onError?.(errorMsg);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          log('Received message:', message.type, message);
          
          setState(prev => ({
            ...prev,
            lastMessage: message
          }));
          
          onMessage?.(message);
        } catch (error) {
          log('Error parsing WebSocket message:', error, event.data);
          const errorMsg = 'Failed to parse WebSocket message';
          setState(prev => ({
            ...prev,
            error: errorMsg
          }));
          onError?.(errorMsg);
        }
      };

    } catch (error) {
      log('Error creating WebSocket:', error);
      const errorMsg = 'Failed to create WebSocket connection';
      setState(prev => ({
        ...prev,
        error: errorMsg,
        isConnecting: false
      }));
      onError?.(errorMsg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onConnect, onDisconnect, onError, onMessage, log, reconnectAttempts]);

  const scheduleReconnect = useCallback((collectionName: string) => {
    if (!shouldConnectRef.current || reconnectAttemptsRef.current >= reconnectAttempts) {
      log('Max reconnect attempts reached or connection disabled');
      return;
    }

    reconnectAttemptsRef.current += 1;
    const attemptNumber = reconnectAttemptsRef.current;
    
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      reconnectInterval * Math.pow(reconnectDecay, attemptNumber - 1),
      maxReconnectInterval
    );
    const jitter = Math.random() * 0.3 * baseDelay;
    const delay = baseDelay + jitter;

    log(`Scheduling reconnect attempt ${attemptNumber}/${reconnectAttempts} in ${Math.round(delay)}ms`);
    
    setState(prev => ({
      ...prev,
      reconnectAttempt: attemptNumber
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      log(`Reconnect attempt ${attemptNumber}/${reconnectAttempts}`);
      connect(collectionName);
    }, delay);
  }, [connect, reconnectAttempts, reconnectInterval, maxReconnectInterval, reconnectDecay, log]);

  const disconnect = useCallback(() => {
    log('Disconnecting WebSocket');
    shouldConnectRef.current = false;
    
    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket connection
    if (websocketRef.current) {
      if (websocketRef.current.readyState === WebSocket.OPEN || 
          websocketRef.current.readyState === WebSocket.CONNECTING) {
        websocketRef.current.close(1000, 'User initiated disconnect');
      }
      websocketRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      reconnectAttempt: 0
    }));
    
    reconnectAttemptsRef.current = 0;
    currentCollectionRef.current = null;
  }, [log]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      log('Cannot send message: WebSocket not connected');
      const errorMsg = 'Cannot send message: not connected';
      setState(prev => ({
        ...prev,
        error: errorMsg
      }));
      onError?.(errorMsg);
      return;
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      log('Sending message:', message);
      websocketRef.current.send(messageStr);
    } catch (error) {
      log('Error sending message:', error);
      const errorMsg = 'Failed to send message';
      setState(prev => ({
        ...prev,
        error: errorMsg
      }));
      onError?.(errorMsg);
    }
  }, [log, onError]);

  const pauseIndexing = useCallback(() => {
    sendMessage({ type: 'pause_indexing' });
  }, [sendMessage]);

  const resumeIndexing = useCallback(() => {
    sendMessage({ type: 'resume_indexing' });
  }, [sendMessage]);

  const cancelIndexing = useCallback(() => {
    sendMessage({ type: 'cancel_indexing' });
  }, [sendMessage]);

  const getStatus = useCallback(() => {
    sendMessage({ type: 'get_status' });
  }, [sendMessage]);

  // Update enabled state
  useEffect(() => {
    shouldConnectRef.current = enabled;
    
    if (!enabled) {
      if (debug) {
        console.log('[useCollectionWebSocket] WebSocket disabled, disconnecting...');
      }
      // Direct disconnect without dependency
      shouldConnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (websocketRef.current) {
        if (websocketRef.current.readyState === WebSocket.OPEN || 
            websocketRef.current.readyState === WebSocket.CONNECTING) {
          websocketRef.current.close(1000, 'Disabled by configuration');
        }
        websocketRef.current = null;
      }
    }
  }, [enabled, debug]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (debug) {
        console.log('[useCollectionWebSocket] Cleaning up WebSocket');
      }
      shouldConnectRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (websocketRef.current) {
        websocketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [debug]);

  // Page visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (debug) {
          console.log('[useCollectionWebSocket] Page hidden, maintaining WebSocket connection');
        }
        // Keep connection alive but reduce activity
      } else {
        if (debug) {
          console.log('[useCollectionWebSocket] Page visible, checking WebSocket connection');
        }
        // If we should be connected but aren't, try to reconnect
        if (shouldConnectRef.current && currentCollectionRef.current &&
            (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN)) {
          if (debug) {
            console.log('[useCollectionWebSocket] Page became visible and WebSocket disconnected, attempting reconnect');
          }
          connect(currentCollectionRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connect, debug]);

  const actions: CollectionWebSocketActions = {
    connect,
    disconnect,
    sendMessage,
    pauseIndexing,
    resumeIndexing,
    cancelIndexing,
    getStatus
  };

  return [state, actions];
};

export default useCollectionWebSocket;