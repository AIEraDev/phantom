"use client";

import React from "react";
import { motion } from "framer-motion";
import { DEBUG_SHIELD_CHARGES } from "@/types/powerups";

interface DebugShieldIndicatorProps {
  remainingCharges: number;
  maxCharges?: number;
}

/**
 * DebugShieldIndicator Component
 * Displays remaining shielded runs when Debug Shield is active
 * Requirements: 4.4
 */
export function DebugShieldIndicator({ remainingCharges, maxCharges = DEBUG_SHIELD_CHARGES }: DebugShieldIndicatorProps) {
  if (remainingCharges <= 0) {
    return null;
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-lime/10 border border-accent-lime/50 shadow-[0_0_20px_rgba(0,255,100,0.2)]">
      {/* Shield Icon */}
      <span className="text-xl">🛡️</span>

      {/* Label */}
      <div className="flex flex-col">
        <span className="text-xs font-bold text-accent-lime uppercase tracking-wider">Debug Shield</span>
        <span className="text-[10px] text-text-muted">Test failures shielded</span>
      </div>

      {/* Charges Display */}
      <div className="flex items-center gap-1 ml-2">
        {Array.from({ length: maxCharges }).map((_, index) => (
          <motion.div
            key={index}
            initial={index < remainingCharges ? { scale: 1 } : { scale: 0.8 }}
            animate={index < remainingCharges ? { scale: 1 } : { scale: 0.8 }}
            className={`
              w-3 h-3 rounded-full transition-all duration-300
              ${index < remainingCharges ? "bg-accent-lime shadow-[0_0_10px_rgba(0,255,100,0.5)]" : "bg-white/10 border border-white/20"}
            `}
          />
        ))}
      </div>

      {/* Numeric Display */}
      <div className="ml-1 px-2 py-0.5 rounded bg-accent-lime/20 border border-accent-lime/30">
        <span className="text-sm font-bold text-accent-lime tabular-nums">
          {remainingCharges}/{maxCharges}
        </span>
      </div>
    </motion.div>
  );
}

export default DebugShieldIndicator;
