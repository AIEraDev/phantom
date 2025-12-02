import { useState, useCallback, useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { PowerUpType, PlayerPowerUpState, PowerUpInventory, ActivePowerUpEffect, DEFAULT_POWERUP_INVENTORY, PowerUpActivatedEvent, OpponentUsedPowerUpEvent, PowerUpEffectExpiredEvent, PowerUpErrorEvent } from "@/types/powerups";

/**
 * Power-up state for the current player
 */
export interface PowerUpUIState {
  inventory: PowerUpInventory;
  cooldownUntil: number | null;
  activeEffect: ActivePowerUpEffect | null;
}

/**
 * Opponent's power-up state (limited visibility)
 */
export interface OpponentPowerUpState {
  activeEffect: ActivePowerUpEffect | null;
  lastUsedPowerUp: PowerUpType | null;
}

/**
 * Code Peek state
 */
export interface CodePeekState {
  isActive: boolean;
  code: string;
  activatedAt: number | null;
}

/**
 * Hook return type
 */
export interface UsePowerUpsReturn {
  // Player state
  inventory: PowerUpInventory;
  cooldownUntil: number | null;
  activeEffect: ActivePowerUpEffect | null;

  // Opponent state
  opponentActiveEffect: ActivePowerUpEffect | null;

  // Code Peek
  codePeekState: CodePeekState;
  dismissCodePeek: () => void;

  // Debug Shield
  debugShieldCharges: number;
  isDebugShieldActive: boolean;

  // Time Freeze
  timeFreezeExpiresAt: number | null;
  opponentTimeFreezeExpiresAt: number | null;

  // Actions
  activatePowerUp: (type: PowerUpType) => void;

  // Error state
  error: string | null;
  clearError: () => void;

  // Loading state
  isActivating: boolean;
}

/**
 * Custom hook for managing power-up state and WebSocket events
 * Requirements: 1.3, 5.4
 */
export function usePowerUps(matchId: string, playerId: string): UsePowerUpsReturn {
  const { emit, on, off } = useWebSocket();

  // Player power-up state
  const [inventory, setInventory] = useState<PowerUpInventory>(DEFAULT_POWERUP_INVENTORY);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [activeEffect, setActiveEffect] = useState<ActivePowerUpEffect | null>(null);

  // Opponent state
  const [opponentActiveEffect, setOpponentActiveEffect] = useState<ActivePowerUpEffect | null>(null);

  // Code Peek state
  const [codePeekState, setCodePeekState] = useState<CodePeekState>({
    isActive: false,
    code: "",
    activatedAt: null,
  });

  // Error and loading state
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  // Track if we've initialized
  const initializedRef = useRef(false);

  // Derived state for Debug Shield
  const debugShieldCharges = activeEffect?.type === "debug_shield" ? activeEffect.remainingCharges ?? 0 : 0;
  const isDebugShieldActive = activeEffect?.type === "debug_shield" && debugShieldCharges > 0;

  // Derived state for Time Freeze
  const timeFreezeExpiresAt = activeEffect?.type === "time_freeze" ? activeEffect.expiresAt : null;
  const opponentTimeFreezeExpiresAt = opponentActiveEffect?.type === "time_freeze" ? opponentActiveEffect.expiresAt : null;

  /**
   * Activate a power-up
   */
  const activatePowerUp = useCallback(
    (type: PowerUpType) => {
      if (isActivating) return;

      setIsActivating(true);
      setError(null);

      emit("activate_powerup", {
        matchId,
        powerUpType: type,
      });
    },
    [matchId, emit, isActivating]
  );

  /**
   * Dismiss Code Peek overlay
   */
  const dismissCodePeek = useCallback(() => {
    setCodePeekState({
      isActive: false,
      code: "",
      activatedAt: null,
    });
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Handle power-up activated event (own activation)
  useEffect(() => {
    const handlePowerUpActivated = (data: PowerUpActivatedEvent) => {
      setIsActivating(false);

      // Only process if this is our activation
      if (data.playerId !== playerId) return;

      // Handle Code Peek - show opponent's code
      if (data.powerUpType === "code_peek" && data.opponentCode !== undefined) {
        setCodePeekState({
          isActive: true,
          code: data.opponentCode,
          activatedAt: Date.now(),
        });
      }

      // Handle Time Freeze - update active effect
      if (data.powerUpType === "time_freeze" && data.freezeExpiresAt) {
        setActiveEffect({
          type: "time_freeze",
          activatedAt: Date.now(),
          expiresAt: data.freezeExpiresAt,
        });
      }

      // Handle Debug Shield - update active effect
      if (data.powerUpType === "debug_shield" && data.shieldedRuns !== undefined) {
        setActiveEffect({
          type: "debug_shield",
          activatedAt: Date.now(),
          expiresAt: 0, // Debug shield doesn't expire by time
          remainingCharges: data.shieldedRuns,
        });
      }
    };

    on("powerup_activated", handlePowerUpActivated);
    return () => off("powerup_activated", handlePowerUpActivated);
  }, [on, off, playerId]);

  // Handle power-up state update (full state sync)
  useEffect(() => {
    const handleStateUpdate = (data: PlayerPowerUpState) => {
      if (data.playerId !== playerId) return;

      setInventory(data.inventory);
      setCooldownUntil(data.cooldownUntil);
      setActiveEffect(data.activeEffect);
    };

    on("powerup_state_update", handleStateUpdate);
    return () => off("powerup_state_update", handleStateUpdate);
  }, [on, off, playerId]);

  // Handle opponent used power-up
  useEffect(() => {
    const handleOpponentUsedPowerUp = (data: OpponentUsedPowerUpEvent) => {
      // Update opponent's active effect based on power-up type
      if (data.powerUpType === "time_freeze") {
        // We'll get the actual expiry from a separate event or timer_sync
        setOpponentActiveEffect({
          type: "time_freeze",
          activatedAt: Date.now(),
          expiresAt: Date.now() + 30000, // 30 seconds
        });
      } else if (data.powerUpType === "debug_shield") {
        setOpponentActiveEffect({
          type: "debug_shield",
          activatedAt: Date.now(),
          expiresAt: 0,
          remainingCharges: 3,
        });
      }
      // Code peek doesn't show as active effect for opponent
    };

    on("opponent_used_powerup", handleOpponentUsedPowerUp);
    return () => off("opponent_used_powerup", handleOpponentUsedPowerUp);
  }, [on, off]);

  // Handle power-up effect expired
  useEffect(() => {
    const handleEffectExpired = (data: PowerUpEffectExpiredEvent) => {
      if (data.playerId === playerId) {
        setActiveEffect(null);
      } else {
        setOpponentActiveEffect(null);
      }
    };

    on("powerup_effect_expired", handleEffectExpired);
    return () => off("powerup_effect_expired", handleEffectExpired);
  }, [on, off, playerId]);

  // Handle power-up error
  useEffect(() => {
    const handleError = (data: PowerUpErrorEvent) => {
      setIsActivating(false);
      setError(data.error);

      // Update cooldown if provided
      if (data.cooldownRemaining !== undefined) {
        setCooldownUntil(Date.now() + data.cooldownRemaining);
      }
    };

    on("powerup_error", handleError);
    return () => off("powerup_error", handleError);
  }, [on, off]);

  // Auto-clear Time Freeze effect when expired
  useEffect(() => {
    if (!timeFreezeExpiresAt) return;

    const remaining = timeFreezeExpiresAt - Date.now();
    if (remaining <= 0) {
      setActiveEffect(null);
      return;
    }

    const timer = setTimeout(() => {
      setActiveEffect(null);
    }, remaining);

    return () => clearTimeout(timer);
  }, [timeFreezeExpiresAt]);

  // Auto-clear opponent Time Freeze effect when expired
  useEffect(() => {
    if (!opponentTimeFreezeExpiresAt) return;

    const remaining = opponentTimeFreezeExpiresAt - Date.now();
    if (remaining <= 0) {
      setOpponentActiveEffect(null);
      return;
    }

    const timer = setTimeout(() => {
      setOpponentActiveEffect(null);
    }, remaining);

    return () => clearTimeout(timer);
  }, [opponentTimeFreezeExpiresAt]);

  return {
    // Player state
    inventory,
    cooldownUntil,
    activeEffect,

    // Opponent state
    opponentActiveEffect,

    // Code Peek
    codePeekState,
    dismissCodePeek,

    // Debug Shield
    debugShieldCharges,
    isDebugShieldActive,

    // Time Freeze
    timeFreezeExpiresAt,
    opponentTimeFreezeExpiresAt,

    // Actions
    activatePowerUp,

    // Error state
    error,
    clearError,

    // Loading state
    isActivating,
  };
}

export default usePowerUps;
