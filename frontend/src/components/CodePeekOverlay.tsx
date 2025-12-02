"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CODE_PEEK_DISPLAY_MS } from "@/types/powerups";

interface CodePeekOverlayProps {
  code: string;
  opponentName?: string;
  onDismiss: () => void;
  displayDuration?: number; // in milliseconds, defaults to 5000
}

/**
 * CodePeekOverlay Component
 * Displays opponent's code snapshot for 5 seconds with auto-dismiss
 * Requirements: 3.2, 3.4
 */
export function CodePeekOverlay({ code, opponentName = "Opponent", onDismiss, displayDuration = CODE_PEEK_DISPLAY_MS }: CodePeekOverlayProps) {
  const [timeRemaining, setTimeRemaining] = useState(displayDuration);
  const [isVisible, setIsVisible] = useState(true);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      setIsVisible(false);
      // Small delay before calling onDismiss to allow exit animation
      const dismissTimer = setTimeout(onDismiss, 300);
      return () => clearTimeout(dismissTimer);
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(timer);
  }, [timeRemaining, onDismiss]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const progressPercent = (timeRemaining / displayDuration) * 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={handleClose}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.3 }} className="relative w-[90%] max-w-4xl max-h-[80vh] bg-background-secondary border border-accent-yellow/50 rounded-lg shadow-[0_0_50px_rgba(252,238,10,0.3)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-accent-yellow/10 border-b border-accent-yellow/30">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👁️</span>
                <div>
                  <h3 className="text-lg font-bold text-accent-yellow">Code Peek Active</h3>
                  <p className="text-xs text-text-muted">Viewing {opponentName}&apos;s code</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Timer */}
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-accent-yellow tabular-nums">{(timeRemaining / 1000).toFixed(1)}s</div>
                </div>

                {/* Close Button */}
                <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Close early">
                  <svg className="w-5 h-5 text-text-muted hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-background-primary">
              <motion.div className="h-full bg-accent-yellow" initial={{ width: "100%" }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.1, ease: "linear" }} />
            </div>

            {/* Code Display */}
            <div className="p-4 max-h-[60vh] overflow-auto">
              <pre className="font-code text-sm text-text-primary whitespace-pre-wrap break-words bg-background-primary/50 rounded-lg p-4 border border-white/10">{code || "// No code yet"}</pre>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-background-primary/50 border-t border-white/10 text-center">
              <span className="text-xs text-text-muted">This is a snapshot of your opponent&apos;s code at the moment of activation</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CodePeekOverlay;
