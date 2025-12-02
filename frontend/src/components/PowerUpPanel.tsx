"use client";

import React, { useState, useEffect } from "react";
import { PowerUpType, PowerUpInventory, POWERUP_INFO } from "@/types/powerups";

interface PowerUpPanelProps {
  inventory: PowerUpInventory;
  cooldownUntil: number | null;
  disabled?: boolean;
  onActivate: (type: PowerUpType) => void;
}

/**
 * PowerUpPanel Component
 * Displays power-up buttons inline to match header button style
 * Requirements: 5.1, 5.2, 5.4
 */
export function PowerUpPanel({ inventory, cooldownUntil, disabled = false, onActivate }: PowerUpPanelProps) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    const updateCooldown = () => {
      if (!cooldownUntil) {
        setCooldownRemaining(0);
        return;
      }
      setCooldownRemaining(Math.max(0, cooldownUntil - Date.now()));
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 100);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const isOnCooldown = cooldownRemaining > 0;

  const powerUps: { type: PowerUpType; count: number }[] = [
    { type: "time_freeze", count: inventory.timeFreeze },
    { type: "code_peek", count: inventory.codePeek },
    { type: "debug_shield", count: inventory.debugShield },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Cooldown indicator */}
      {isOnCooldown && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30">
          <div className="w-2 h-2 rounded-full bg-accent-yellow animate-pulse" />
          <span className="text-xs font-bold text-accent-yellow tabular-nums">{Math.ceil(cooldownRemaining / 1000)}s</span>
        </div>
      )}

      {/* Power-up buttons */}
      {powerUps.map(({ type, count }) => {
        const info = POWERUP_INFO[type];
        const isUnavailable = count === 0;
        const isDisabled = disabled || isOnCooldown || isUnavailable;

        return (
          <button
            key={type}
            onClick={() => !isDisabled && onActivate(type)}
            disabled={isDisabled}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all duration-300
              ${isDisabled ? "bg-white/5 text-text-muted border border-white/10 opacity-50 cursor-not-allowed" : "bg-white/5 text-text-secondary hover:bg-white/10 border border-white/10 hover:text-white"}
            `}
            title={`${info.name}: ${info.description} (${count} remaining)`}
          >
            <span className="text-base">{info.icon}</span>
            <span className="hidden xl:inline text-xs">{info.name.split(" ")[0]}</span>
            <span
              className={`
                min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold
                ${isUnavailable ? "bg-red-500/20 text-red-400" : "bg-accent-cyan/20 text-accent-cyan"}
              `}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default PowerUpPanel;
