"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TIME_FREEZE_DURATION_MS } from "@/types/powerups";

interface TimeFreezeIndicatorProps {
  expiresAt: number; // Unix timestamp when freeze expires
  isOwnFreeze?: boolean; // true if this player activated it, false if opponent
  playerName?: string; // Name of player who activated (for opponent view)
}

/**
 * TimeFreezeIndicator Component
 * Displays visual indicator when Time Freeze is active with remaining time
 * Requirements: 2.1, 7.3
 */
export function TimeFreezeIndicator({ expiresAt, isOwnFreeze = true, playerName }: TimeFreezeIndicatorProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(true);

  // Calculate and update remaining time
  useEffect(() => {
    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        setIsVisible(false);
      }
    };

    // Initial calculation
    updateRemaining();

    // Update every 100ms for smooth countdown
    const timer = setInterval(updateRemaining, 100);

    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!isVisible || timeRemaining <= 0) {
    return null;
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const progressPercent = (timeRemaining / TIME_FREEZE_DURATION_MS) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`
          relative overflow-hidden
          flex items-center gap-3 px-4 py-3 rounded-lg
          ${isOwnFreeze ? "bg-accent-cyan/10 border border-accent-cyan/50 shadow-[0_0_30px_rgba(0,240,255,0.3)]" : "bg-accent-magenta/10 border border-accent-magenta/50 shadow-[0_0_30px_rgba(255,0,255,0.3)]"}
        `}
      >
        {/* Animated Background */}
        <motion.div
          className={`absolute inset-0 ${isOwnFreeze ? "bg-accent-cyan/5" : "bg-accent-magenta/5"}`}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Icon with pulse animation */}
        <motion.span
          className="text-2xl relative z-10"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          ⏸️
        </motion.span>

        {/* Content */}
        <div className="flex flex-col relative z-10">
          <span className={`text-sm font-bold uppercase tracking-wider ${isOwnFreeze ? "text-accent-cyan" : "text-accent-magenta"}`}>{isOwnFreeze ? "Time Freeze Active" : `${playerName || "Opponent"}'s Time Frozen`}</span>
          <span className="text-[10px] text-text-muted">{isOwnFreeze ? "Your timer is paused" : "Their timer is paused"}</span>
        </div>

        {/* Timer Display */}
        <div
          className={`
            ml-auto px-3 py-1.5 rounded-lg relative z-10
            ${isOwnFreeze ? "bg-accent-cyan/20 border border-accent-cyan/30" : "bg-accent-magenta/20 border border-accent-magenta/30"}
          `}
        >
          <span className={`text-xl font-bold tabular-nums ${isOwnFreeze ? "text-accent-cyan" : "text-accent-magenta"}`}>{formatTime(timeRemaining)}</span>
        </div>

        {/* Progress Bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
          <motion.div className={`h-full ${isOwnFreeze ? "bg-accent-cyan" : "bg-accent-magenta"}`} style={{ width: `${progressPercent}%` }} transition={{ duration: 0.1, ease: "linear" }} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TimeFreezeIndicator;
