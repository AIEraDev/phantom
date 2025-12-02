import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  ERROR = "error",
}

type EventListener = (...args: any[]) => void;

interface EventListeners {
  [event: string]: EventListener[];
}

class WebSocketService {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private eventListeners: EventListeners = {};
  private stateChangeListeners: Array<(state: ConnectionState) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // 1 second
  private maxReconnectDelay = 30000; // 30 seconds

  /**
   * Connect to the WebSocket server with JWT authentication
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      console.warn("WebSocket already connected");
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: false, // We'll handle reconnection manually
    });

    this.setupSocketListeners();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  /**
   * Register an event listener
   */
  on(event: string, listener: EventListener): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);

    // If socket is already connected, register the listener immediately
    if (this.socket) {
      this.socket.on(event, listener);
    }
  }

  /**
   * Unregister an event listener
   */
  off(event: string, listener?: EventListener): void {
    if (!listener) {
      // Remove all listeners for this event
      delete this.eventListeners[event];
      if (this.socket) {
        this.socket.off(event);
      }
    } else {
      // Remove specific listener
      const listeners = this.eventListeners[event];
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      if (this.socket) {
        this.socket.off(event, listener);
      }
    }
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, ...args: any[]): void {
    if (!this.socket) {
      console.error("Cannot emit event: WebSocket not connected");
      return;
    }
    this.socket.emit(event, ...args);
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if the WebSocket is connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Register a listener for connection state changes
   */
  onStateChange(listener: (state: ConnectionState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Unregister a connection state change listener
   */
  offStateChange(listener: (state: ConnectionState) => void): void {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection successful
    this.socket.on("connect", () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
      this.setConnectionState(ConnectionState.CONNECTED);
    });

    // Connection error
    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      this.setConnectionState(ConnectionState.ERROR);
      this.handleReconnection();
    });

    // Disconnection
    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      this.setConnectionState(ConnectionState.DISCONNECTED);

      // Only attempt reconnection if it wasn't a manual disconnect
      if (reason !== "io client disconnect") {
        this.handleReconnection();
      }
    });

    // Register all previously registered event listeners
    Object.entries(this.eventListeners).forEach(([event, listeners]) => {
      listeners.forEach((listener) => {
        this.socket!.on(event, listener);
      });
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.setConnectionState(ConnectionState.ERROR);
      return;
    }

    this.setConnectionState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (token) {
          this.socket.connect();
        } else {
          console.error("Cannot reconnect: No authentication token found");
          this.setConnectionState(ConnectionState.ERROR);
        }
      }
    }, delay);
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateChangeListeners.forEach((listener) => listener(state));
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
