"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PowerUpInventory, PowerUpType } from "@/types/powerups";

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Time Freeze
  timeFreezeExpiresAt: number | null;
  opponentTimeFreezeExpiresAt: number | null;
  // Debug Shield
  isDebugShieldActive: boolean;
  debugShieldCharges: number;
  // Power-ups
  powerUpInventory: PowerUpInventory;
  powerUpCooldownUntil: number | null;
  onActivatePowerUp: (type: PowerUpType) => void;
  disabled?: boolean;
}

export function StatusModal({ isOpen, onClose, timeFreezeExpiresAt, opponentTimeFreezeExpiresAt, isDebugShieldActive, debugShieldCharges, powerUpInventory, powerUpCooldownUntil, onActivatePowerUp, disabled = false }: StatusModalProps) {
  const [timeRemaining, setTimeRemaining] = React.useState(0);
  const [opponentTimeRemaining, setOpponentTimeRemaining] = React.useState(0);
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

  // Update timers
  React.useEffect(() => {
    const updateTimers = () => {
      const now = Date.now();
      setTimeRemaining(timeFreezeExpiresAt ? Math.max(0, timeFreezeExpiresAt - now) : 0);
      setOpponentTimeRemaining(opponentTimeFreezeExpiresAt ? Math.max(0, opponentTimeFreezeExpiresAt - now) : 0);
      setCooldownRemaining(powerUpCooldownUntil ? Math.max(0, powerUpCooldownUntil - now) : 0);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 100);
    return () => clearInterval(interval);
  }, [timeFreezeExpiresAt, opponentTimeFreezeExpiresAt, powerUpCooldownUntil]);

  const formatTime = (ms: number) => `${Math.ceil(ms / 1000)}s`;

  const isOnCooldown = cooldownRemaining > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
          <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full sm:max-w-md bg-background-secondary border-t sm:border border-white/10 sm:rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-background-secondary/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <h2 className="text-lg font-bold text-white">Power-Ups & Status</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Active Effects Section */}
              {(timeRemaining > 0 || opponentTimeRemaining > 0 || isDebugShieldActive) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Active Effects</h3>

                  {/* Own Time Freeze */}
                  {timeRemaining > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30">
                      <motion.span className="text-2xl" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                        ⏸️
                      </motion.span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-accent-cyan">Time Freeze Active</p>
                        <p className="text-xs text-text-muted">Your timer is paused</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-accent-cyan/20 border border-accent-cyan/30">
                        <span className="text-lg font-bold text-accent-cyan tabular-nums">{formatTime(timeRemaining)}</span>
                      </div>
                    </div>
                  )}

                  {/* Opponent Time Freeze */}
                  {opponentTimeRemaining > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-magenta/10 border border-accent-magenta/30">
                      <motion.span className="text-2xl" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                        ⏸️
                      </motion.span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-accent-magenta">Opponent&apos;s Time Frozen</p>
                        <p className="text-xs text-text-muted">Their timer is paused</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-accent-magenta/20 border border-accent-magenta/30">
                        <span className="text-lg font-bold text-accent-magenta tabular-nums">{formatTime(opponentTimeRemaining)}</span>
                      </div>
                    </div>
                  )}

                  {/* Debug Shield */}
                  {isDebugShieldActive && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-lime/10 border border-accent-lime/30">
                      <span className="text-2xl">🛡️</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-accent-lime">Debug Shield Active</p>
                        <p className="text-xs text-text-muted">Test failures shielded</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < debugShieldCharges ? "bg-accent-lime shadow-[0_0_8px_rgba(0,255,100,0.5)]" : "bg-white/10 border border-white/20"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cooldown Indicator */}
              {isOnCooldown && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30">
                  <div className="w-3 h-3 rounded-full bg-accent-yellow animate-pulse" />
                  <span className="text-sm text-accent-yellow">
                    Cooldown: <span className="font-bold tabular-nums">{formatTime(cooldownRemaining)}</span>
                  </span>
                </div>
              )}

              {/* Power-Up Buttons */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Available Power-Ups</h3>

                <div className="grid grid-cols-3 gap-3">
                  {/* Time Freeze */}
                  <PowerUpCard icon="⏱️" name="Time Freeze" count={powerUpInventory.timeFreeze} color="cyan" disabled={disabled || isOnCooldown || powerUpInventory.timeFreeze === 0} onClick={() => onActivatePowerUp("time_freeze")} />

                  {/* Code Peek */}
                  <PowerUpCard icon="👁️" name="Code Peek" count={powerUpInventory.codePeek} color="magenta" disabled={disabled || isOnCooldown || powerUpInventory.codePeek === 0} onClick={() => onActivatePowerUp("code_peek")} />

                  {/* Debug Shield */}
                  <PowerUpCard icon="🛡️" name="Debug Shield" count={powerUpInventory.debugShield} color="lime" disabled={disabled || isOnCooldown || powerUpInventory.debugShield === 0} onClick={() => onActivatePowerUp("debug_shield")} />
                </div>
              </div>

              {/* Help Text */}
              <p className="text-center text-xs text-text-muted pt-2">{isOnCooldown ? "Wait for cooldown before using another power-up" : "Tap a power-up to activate"}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PowerUpCardProps {
  icon: string;
  name: string;
  count: number;
  color: "cyan" | "magenta" | "lime";
  disabled: boolean;
  onClick: () => void;
}

function PowerUpCard({ icon, name, count, color, disabled, onClick }: PowerUpCardProps) {
  const colorClasses = {
    cyan: {
      bg: "bg-accent-cyan/10 hover:bg-accent-cyan/20",
      border: "border-accent-cyan/30",
      text: "text-accent-cyan",
      shadow: "shadow-[0_0_15px_rgba(0,240,255,0.3)]",
    },
    magenta: {
      bg: "bg-accent-magenta/10 hover:bg-accent-magenta/20",
      border: "border-accent-magenta/30",
      text: "text-accent-magenta",
      shadow: "shadow-[0_0_15px_rgba(255,0,255,0.3)]",
    },
    lime: {
      bg: "bg-accent-lime/10 hover:bg-accent-lime/20",
      border: "border-accent-lime/30",
      text: "text-accent-lime",
      shadow: "shadow-[0_0_15px_rgba(0,255,100,0.3)]",
    },
  };

  const colors = colorClasses[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center gap-2 p-3 rounded-lg border transition-all
        ${disabled ? "opacity-40 cursor-not-allowed bg-white/5 border-white/10" : `${colors.bg} ${colors.border} active:scale-95`}
        ${!disabled && count > 0 ? colors.shadow : ""}
      `}
    >
      <span className="text-2xl">{icon}</span>
      <span className={`text-xs font-bold ${disabled ? "text-text-muted" : colors.text}`}>{name}</span>
      <span className={`text-lg font-bold tabular-nums ${disabled ? "text-text-muted" : colors.text}`}>{count}</span>
    </button>
  );
}

export default StatusModal;
