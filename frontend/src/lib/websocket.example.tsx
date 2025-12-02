/**
 * WebSocket Service Usage Examples
 *
 * This file demonstrates how to use the WebSocket service and hooks
 * in the Phantom application.
 */

import { useEffect } from "react";
import { websocketService, ConnectionState } from "./websocket";
import { useWebSocket, useWebSocketConnection, useWebSocketEvent } from "@/hooks/useWebSocket";

// ============================================================================
// Example 1: Direct Service Usage (without React)
// ============================================================================

export function directServiceExample() {
  // Get JWT token from localStorage
  const token = localStorage.getItem("token");

  if (!token) {
    console.error("No authentication token found");
    return;
  }

  // Connect to WebSocket server
  websocketService.connect(token);

  // Listen for connection state changes
  websocketService.onStateChange((state) => {
    console.log("Connection state changed:", state);

    if (state === ConnectionState.CONNECTED) {
      console.log("WebSocket connected successfully!");
    } else if (state === ConnectionState.ERROR) {
      console.error("WebSocket connection failed");
    }
  });

  // Register event listeners
  websocketService.on("match_found", (data) => {
    console.log("Match found:", data);
  });

  websocketService.on("opponent_code_update", (data) => {
    console.log("Opponent updated code:", data);
  });

  // Emit events
  websocketService.emit("join_queue", { difficulty: "medium" });

  // Cleanup
  websocketService.disconnect();
}

// ============================================================================
// Example 2: Using React Hooks - Basic Usage
// ============================================================================

export function BasicWebSocketComponent() {
  const { connectionState, isConnected, connect, emit } = useWebSocket();

  useEffect(() => {
    // Connect on mount
    const token = localStorage.getItem("token");
    if (token) {
      connect(token);
    }
  }, [connect]);

  const handleJoinQueue = () => {
    if (isConnected) {
      emit("join_queue", { difficulty: "medium" });
    }
  };

  return (
    <div>
      <p>Connection Status: {connectionState}</p>
      <button onClick={handleJoinQueue} disabled={!isConnected}>
        Join Queue
      </button>
    </div>
  );
}

// ============================================================================
// Example 3: Auto-Connect Hook
// ============================================================================

export function AutoConnectComponent() {
  // Automatically connects using token from localStorage
  const { isConnected, connectionState } = useWebSocketConnection();

  return <div>{isConnected ? <span className="text-green-500">● Connected</span> : <span className="text-red-500">● {connectionState}</span>}</div>;
}

// ============================================================================
// Example 4: Event Listener Hook
// ============================================================================

export function MatchmakingComponent() {
  const { emit } = useWebSocket();

  // Listen for match_found event
  useWebSocketEvent("match_found", (data: any) => {
    console.log("Match found!", data);
    // Navigate to lobby or update UI
  });

  // Listen for queue_position event
  useWebSocketEvent("queue_position", (data: any) => {
    console.log("Queue position:", data.position);
  });

  const joinQueue = () => {
    emit("join_queue", { difficulty: "medium", language: "javascript" });
  };

  const leaveQueue = () => {
    emit("leave_queue");
  };

  return (
    <div>
      <button onClick={joinQueue}>Join Queue</button>
      <button onClick={leaveQueue}>Leave Queue</button>
    </div>
  );
}

// ============================================================================
// Example 5: Battle Arena with Real-time Code Sync
// ============================================================================

export function BattleArenaComponent({ matchId }: { matchId: string }) {
  const { emit } = useWebSocket();

  // Listen for opponent's code updates
  useWebSocketEvent("opponent_code_update", (data: { code: string; cursor: { line: number; column: number } }) => {
    console.log("Opponent code:", data.code);
    console.log("Opponent cursor:", data.cursor);
    // Update opponent's editor view
  });

  // Listen for test results
  useWebSocketEvent("test_result", (data: any) => {
    console.log("Test results:", data.results);
    // Update UI with test results
  });

  // Listen for match results
  useWebSocketEvent("match_result", (data: any) => {
    console.log("Match completed:", data);
    // Navigate to results page
  });

  const handleCodeChange = (code: string, cursor: { line: number; column: number }) => {
    // Throttle this in production (100ms intervals)
    emit("code_update", { matchId, code, cursor });
  };

  const handleRunTests = (code: string) => {
    emit("run_code", { matchId, code });
  };

  const handleSubmit = (code: string) => {
    emit("submit_solution", { matchId, code });
  };

  return (
    <div>
      {/* Editor and UI components */}
      <button onClick={() => handleRunTests("console.log('test')")}>Run Tests</button>
      <button onClick={() => handleSubmit("console.log('final')")}>Submit</button>
    </div>
  );
}

// ============================================================================
// Example 6: Spectator Mode
// ============================================================================

export function SpectatorComponent({ matchId }: { matchId: string }) {
  const { emit } = useWebSocket();

  useEffect(() => {
    // Join spectator mode
    emit("join_spectate", { matchId });
  }, [matchId, emit]);

  // Listen for spectator-specific events
  useWebSocketEvent("spectator_joined", (data: { count: number }) => {
    console.log("Spectator count:", data.count);
  });

  useWebSocketEvent("spectator_message", (data: { username: string; message: string }) => {
    console.log(`${data.username}: ${data.message}`);
  });

  const sendMessage = (message: string) => {
    emit("spectator_message", { matchId, message });
  };

  return (
    <div>
      {/* Spectator UI */}
      <button onClick={() => sendMessage("Great play!")}>Send Message</button>
    </div>
  );
}

// ============================================================================
// Example 7: Connection State Management
// ============================================================================

export function ConnectionIndicator() {
  const { connectionState, isConnected } = useWebSocket();

  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return "bg-green-500";
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return "bg-yellow-500";
      case ConnectionState.ERROR:
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return "Connected";
      case ConnectionState.CONNECTING:
        return "Connecting...";
      case ConnectionState.RECONNECTING:
        return "Reconnecting...";
      case ConnectionState.ERROR:
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-sm">{getStatusText()}</span>
    </div>
  );
}

// ============================================================================
// Example 8: Handling Reconnection
// ============================================================================

export function ReconnectionHandler() {
  const { connectionState } = useWebSocket();

  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED) {
      // Reconnected successfully - resync state
      console.log("Reconnected! Syncing state...");
      // Fetch current match state, rejoin rooms, etc.
    }
  }, [connectionState]);

  if (connectionState === ConnectionState.RECONNECTING) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div className="bg-gray-800 p-6 rounded-lg">
          <p className="text-white">Reconnecting to server...</p>
        </div>
      </div>
    );
  }

  if (connectionState === ConnectionState.ERROR) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div className="bg-red-900 p-6 rounded-lg">
          <p className="text-white">Connection failed. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return null;
}
