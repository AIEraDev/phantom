import { useEffect, useState, useCallback, useRef } from "react";
import { websocketService, ConnectionState } from "@/lib/websocket";

/**
 * React hook for managing WebSocket connection and events
 */
export function useWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(websocketService.getConnectionState());
  const isInitialized = useRef(false);

  useEffect(() => {
    // Subscribe to connection state changes
    const handleStateChange = (state: ConnectionState) => {
      setConnectionState(state);
    };

    websocketService.onStateChange(handleStateChange);

    return () => {
      websocketService.offStateChange(handleStateChange);
    };
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback((token: string) => {
    websocketService.connect(token);
  }, []);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  /**
   * Register an event listener
   */
  const on = useCallback((event: string, listener: (...args: any[]) => void) => {
    websocketService.on(event, listener);
  }, []);

  /**
   * Unregister an event listener
   */
  const off = useCallback((event: string, listener?: (...args: any[]) => void) => {
    websocketService.off(event, listener);
  }, []);

  /**
   * Emit an event to the server
   */
  const emit = useCallback((event: string, ...args: any[]) => {
    websocketService.emit(event, ...args);
  }, []);

  /**
   * Check if connected
   */
  const isConnected = connectionState === ConnectionState.CONNECTED;

  return {
    connectionState,
    isConnected,
    connect,
    disconnect,
    on,
    off,
    emit,
  };
}

/**
 * Hook for automatically connecting to WebSocket on mount
 */
export function useWebSocketConnection() {
  const { connect, disconnect, connectionState, isConnected } = useWebSocket();
  const hasConnected = useRef(false);

  useEffect(() => {
    // Only connect once
    if (hasConnected.current) return;

    // Get token from localStorage
    const token = localStorage.getItem("token");

    if (token) {
      hasConnected.current = true;
      console.log("Connecting to WebSocket...");
      connect(token);
    }

    // Cleanup on unmount
    return () => {
      if (hasConnected.current) {
        disconnect();
        hasConnected.current = false;
      }
    };
  }, [connect, disconnect]);

  return {
    connectionState,
    isConnected,
  };
}

/**
 * Hook for listening to a specific WebSocket event
 */
export function useWebSocketEvent<T = any>(event: string, handler: (data: T) => void, dependencies: any[] = []) {
  const { on, off } = useWebSocket();

  useEffect(() => {
    const wrappedHandler = (data: T) => {
      handler(data);
    };

    on(event, wrappedHandler);

    return () => {
      off(event, wrappedHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, on, off, ...dependencies]);
}
