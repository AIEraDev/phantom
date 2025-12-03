"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectionState } from "@/lib/websocket";
import { useWebSocket } from "@/hooks/useWebSocket";

/**
 * Offline indicator component that shows connection status
 * Displays when WebSocket is disconnected or reconnecting
 */
export function OfflineIndicator() {
  const [mounted, setMounted] = useState(false);
  const { connectionState } = useWebSocket();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isOffline = connectionState === ConnectionState.DISCONNECTED;
  const isReconnecting = connectionState === ConnectionState.RECONNECTING;

  const showIndicator = isOffline || isReconnecting;

  return (
    <AnimatePresence>
      {showIndicator && (
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} transition={{ duration: 0.3 }} className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center">
          <div className={`px-6 py-3 rounded-b-lg backdrop-blur-md shadow-lg border-b border-x ${isReconnecting ? "bg-accent-yellow/20 border-accent-yellow text-accent-yellow" : "bg-accent-red/20 border-accent-red text-accent-red"}`}>
            <div className="flex items-center gap-3">
              {isReconnecting ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-accent-yellow border-t-transparent rounded-full" />
                  <span className="text-sm font-semibold">Reconnecting...</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-accent-red rounded-full" />
                  <span className="text-sm font-semibold">Connection lost</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Connection status badge for displaying in UI
 */
export function ConnectionStatusBadge() {
  const { connectionState, isConnected } = useWebSocket();

  const statusConfig: Record<ConnectionState, { color: string; text: string; pulse: boolean }> = {
    [ConnectionState.CONNECTED]: {
      color: "bg-accent-lime",
      text: "Connected",
      pulse: true,
    },
    [ConnectionState.CONNECTING]: {
      color: "bg-accent-yellow",
      text: "Connecting",
      pulse: true,
    },
    [ConnectionState.RECONNECTING]: {
      color: "bg-accent-yellow",
      text: "Reconnecting",
      pulse: true,
    },
    [ConnectionState.DISCONNECTED]: {
      color: "bg-accent-red",
      text: "Disconnected",
      pulse: false,
    },
    [ConnectionState.ERROR]: {
      color: "bg-accent-red",
      text: "Error",
      pulse: false,
    },
  };

  const config = statusConfig[connectionState];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-secondary/50 backdrop-blur-sm border border-border-default">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.pulse && <motion.div className={`absolute inset-0 w-2 h-2 rounded-full ${config.color}`} animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }} transition={{ duration: 2, repeat: Infinity }} />}
      </div>
      <span className="text-xs font-medium text-text-secondary">{config.text}</span>
    </div>
  );
}
