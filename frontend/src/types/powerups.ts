// Power-Up System type definitions for frontend
// Requirements: 5.1

/**
 * Power-up type enumeration
 */
export type PowerUpType = "time_freeze" | "code_peek" | "debug_shield";

/**
 * Individual power-up inventory counts
 * Each player starts with 1 of each power-up per match
 */
export interface PowerUpInventory {
  timeFreeze: number;
  codePeek: number;
  debugShield: number;
}

/**
 * Active power-up effect (only one can be active at a time per player)
 */
export interface ActivePowerUpEffect {
  type: PowerUpType;
  activatedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp (for time_freeze)
  remainingCharges?: number; // For debug_shield (starts at 3)
}

/**
 * Per-player power-up state
 */
export interface PlayerPowerUpState {
  playerId: string;
  inventory: PowerUpInventory;
  cooldownUntil: number | null; // Unix timestamp when cooldown expires
  activeEffect: ActivePowerUpEffect | null;
}

/**
 * Complete match power-up state
 */
export interface MatchPowerUpState {
  matchId: string;
  player1: PlayerPowerUpState;
  player2: PlayerPowerUpState;
  createdAt: number;
  updatedAt: number;
}

/**
 * Error codes for power-up activation failures
 */
export type PowerUpErrorCode = "NO_POWERUP" | "ON_COOLDOWN" | "MATCH_NOT_ACTIVE" | "INVALID_TYPE" | "UNAUTHORIZED" | "MATCH_NOT_FOUND";

/**
 * Result of power-up activation attempt
 */
export interface PowerUpActivationResult {
  success: boolean;
  error?: string;
  errorCode?: PowerUpErrorCode;
  cooldownRemaining?: number;
  newState?: PlayerPowerUpState;
  // For Code Peek
  opponentCode?: string;
  // For Time Freeze
  freezeExpiresAt?: number;
  // For Debug Shield
  shieldedRunsRemaining?: number;
}

/**
 * Cooldown check result
 */
export interface CooldownCheckResult {
  canUse: boolean;
  cooldownRemaining: number; // 0 if can use
}

/**
 * Debug Shield status
 */
export interface DebugShieldStatus {
  isActive: boolean;
  remainingCharges: number;
  wasConsumed: boolean;
}

// WebSocket Event Types

/**
 * Data sent when activating a power-up
 */
export interface ActivatePowerUpData {
  matchId: string;
  powerUpType: PowerUpType;
}

/**
 * Data received when a power-up is activated
 */
export interface PowerUpActivatedEvent {
  playerId: string;
  powerUpType: PowerUpType;
  // Type-specific data
  opponentCode?: string; // For code_peek (only to requester)
  freezeExpiresAt?: number; // For time_freeze
  shieldedRuns?: number; // For debug_shield
}

/**
 * Data received when opponent uses a power-up
 */
export interface OpponentUsedPowerUpEvent {
  powerUpType: PowerUpType;
}

/**
 * Data received for spectator power-up events
 */
export interface SpectatorPowerUpEvent {
  playerId: string;
  username: string;
  powerUpType: PowerUpType;
  timestamp: number;
}

/**
 * Data received when a power-up effect expires
 */
export interface PowerUpEffectExpiredEvent {
  playerId: string;
  powerUpType: PowerUpType;
}

/**
 * Data received for power-up errors
 */
export interface PowerUpErrorEvent {
  error: string;
  code: PowerUpErrorCode;
  cooldownRemaining?: number;
}

// Constants
export const POWERUP_COOLDOWN_MS = 60_000; // 60 seconds
export const TIME_FREEZE_DURATION_MS = 30_000; // 30 seconds
export const DEBUG_SHIELD_CHARGES = 3; // 3 test runs
export const CODE_PEEK_DISPLAY_MS = 5_000; // 5 seconds

/**
 * Default inventory for a new match
 */
export const DEFAULT_POWERUP_INVENTORY: PowerUpInventory = {
  timeFreeze: 1,
  codePeek: 1,
  debugShield: 1,
};

/**
 * Power-up display information
 */
export const POWERUP_INFO: Record<PowerUpType, { name: string; description: string; icon: string }> = {
  time_freeze: {
    name: "Time Freeze",
    description: "Pause your timer for 30 seconds",
    icon: "⏸️",
  },
  code_peek: {
    name: "Code Peek",
    description: "See your opponent's code for 5 seconds",
    icon: "👁️",
  },
  debug_shield: {
    name: "Debug Shield",
    description: "Shield your next 3 test runs from failures",
    icon: "🛡️",
  },
};
