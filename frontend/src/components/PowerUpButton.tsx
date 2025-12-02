"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { PowerUpType, POWERUP_INFO } from "@/types/powerups";

interface PowerUpButtonProps {
  type: PowerUpType;
  count: number;
  cooldownRemaining: number; // in milliseconds
  disabled?: boolean;
  onActivate: (type: PowerUpType) => void;
}

/**
 * PowerUpButton Component
 * Displays a single power-up with icon, count, and cooldown timer
 * Requirements: 5.1, 5.2, 5.3
 */
export function PowerUpButton({ type, count, cooldownRemaining, disabled = false, onActivate }: PowerUpButtonProps) {
  const [localCooldown, setLocalCooldown] = useState(cooldownRemaining);
  const info = POWERUP_INFO[type];

  // Update local cooldown when prop changes
  useEffect(() => {
    setLocalCooldown(cooldownRemaining);
  }, [cooldownRemaining]);

  // Countdown timer for cooldown display
  useEffect(() => {
    if (localCooldown <= 0) return;

    const timer = setInterval(() => {
      setLocalCooldown((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [localCooldown > 0]);

  const handleClick = useCallback(() => {
    if (!disabled && count > 0 && localCooldown <= 0) {
      onActivate(type);
    }
  }, [disabled, count, localCooldown, onActivate, type]);

  const isOnCooldown = localCooldown > 0;
  const isUnavailable = count === 0;
  const isDisabled = disabled || isOnCooldown || isUnavailable;

  const formatCooldown = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  // Get color based on power-up type
  const getTypeColor = (): string => {
    switch (type) {
      case "time_freeze":
        return "cyan";
      case "code_peek":
        return "yellow";
      case "debug_shield":
        return "lime";
      default:
        return "cyan";
    }
  };

  const color = getTypeColor();

  return (
    <motion.button
      onClick={handleClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.05 } : undefined}
      whileTap={!isDisabled ? { scale: 0.95 } : undefined}
      className={`
        relative flex flex-col items-center justify-center
        w-20 h-20 rounded-lg
        border transition-all duration-300
        ${isDisabled ? "bg-white/5 border-white/10 cursor-not-allowed opacity-50" : `bg-accent-${color}/10 border-accent-${color}/50 hover:bg-accent-${color}/20 hover:border-accent-${color} cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.1)] hover:shadow-[0_0_25px_rgba(0,240,255,0.2)]`}
      `}
      title={`${info.name}: ${info.description}`}
    >
      {/* Icon */}
      <span className="text-2xl mb-1">{info.icon}</span>

      {/* Name */}
      <span className={`text-[10px] font-bold uppercase tracking-wider ${isDisabled ? "text-text-muted" : `text-accent-${color}`}`}>{info.name.split(" ")[0]}</span>

      {/* Count Badge */}
      <div
        className={`
          absolute -top-1 -right-1
          w-5 h-5 rounded-full
          flex items-center justify-center
          text-xs font-bold
          ${isUnavailable ? "bg-red-500/20 text-red-400 border border-red-500/50" : `bg-accent-${color}/20 text-accent-${color} border border-accent-${color}/50`}
        `}
      >
        {count}
      </div>

      {/* Cooldown Overlay */}
      {isOnCooldown && (
        <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-white tabular-nums">{formatCooldown(localCooldown)}</div>
            <div className="text-[8px] text-text-muted uppercase">Cooldown</div>
          </div>
        </div>
      )}

      {/* Unavailable Overlay */}
      {isUnavailable && !isOnCooldown && (
        <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
          <span className="text-xs text-red-400 font-bold">USED</span>
        </div>
      )}
    </motion.button>
  );
}

export default PowerUpButton;
