import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage } from '@/types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketOptions {
  url?: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  reconnectDecay?: number;
  maxReconnectInterval?: number;
  timeoutInterval?: number;
}

export interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: Record<string, unknown>) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  disconnect: () => void;
  reconnect: () => void;
}

const useWebSocket = (options: WebSocketOptions = {}): UseWebSocketReturn => {
  const {
    url = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws',
    protocols,
    reconnectInterval = 1000,
    maxReconnectAttempts = 5,
    reconnectDecay = 1.5,
    maxReconnectInterval = 30000,
    // timeoutInterval = 2000, // Reserved for future use
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const subscriptions = useRef<Set<string>>(new Set());
  const messageQueue = useRef<Record<string, unknown>[]>([]);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
    }

    const delay = Math.min(
      reconnectInterval * Math.pow(reconnectDecay, reconnectAttempts.current),
      maxReconnectInterval
    );

    console.log(`[WebSocket] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

    reconnectTimeoutId.current = setTimeout(() => {
      reconnectAttempts.current += 1;
      connectWebSocket();
    }, delay);
  }, [reconnectInterval, reconnectDecay, maxReconnectInterval, maxReconnectAttempts]);

  const connectWebSocket = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      ws.current = new WebSocket(url, protocols);
      
      ws.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;

        // Send queued messages
        while (messageQueue.current.length > 0) {
          const message = messageQueue.current.shift();
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(message));
          }
        }

        // Re-subscribe to channels
        subscriptions.current.forEach(channel => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              action: 'subscribe',
              channel,
            }));
          }
        });
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message);
          setLastMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        ws.current = null;

        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          scheduleReconnect();
        }
      };

      ws.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setConnectionStatus('error');
      scheduleReconnect();
    }
  }, [url, protocols, maxReconnectAttempts, scheduleReconnect]);

  const connect = connectWebSocket;

  const disconnect = useCallback(() => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }

    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect');
      ws.current = null;
    }

    setConnectionStatus('disconnected');
    reconnectAttempts.current = 0;
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      reconnectAttempts.current = 0;
      connect();
    }, 100);
  }, [disconnect, connect]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is established
      messageQueue.current.push(message);
      console.warn('[WebSocket] Message queued - connection not open');
    }
  }, []);

  const subscribe = useCallback((channel: string) => {
    subscriptions.current.add(channel);
    sendMessage({
      action: 'subscribe',
      channel,
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((channel: string) => {
    subscriptions.current.delete(channel);
    sendMessage({
      action: 'unsubscribe',
      channel,
    });
  }, [sendMessage]);

  // Connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Heartbeat to detect connection issues
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const heartbeatInterval = setInterval(() => {
      sendMessage({ action: 'ping' });
    }, 30000); // Send ping every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [connectionStatus, sendMessage]);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe,
    disconnect,
    reconnect,
  };
};

export default useWebSocket;