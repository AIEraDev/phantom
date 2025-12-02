// Power-Up System type definitions
// Requirements: 1.1, 1.2, 9.1, 9.2

/**
 * Power-up type enumeration
 */
export type PowerUpType = "time_freeze" | "code_peek" | "debug_shield";

/**
 * Individual power-up inventory counts
 * Each player starts with 1 of each power-up per match
 */
export interface PowerUpInventory {
  timeFreeze: number; // Default: 1
  codePeek: number; // Default: 1
  debugShield: number; // Default: 1
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
 * Debug Shield status after consuming a charge
 */
export interface DebugShieldStatus {
  isActive: boolean;
  remainingCharges: number;
  wasConsumed: boolean;
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
 * Creates a default player power-up state
 */
export function createDefaultPlayerPowerUpState(playerId: string): PlayerPowerUpState {
  return {
    playerId,
    inventory: { ...DEFAULT_POWERUP_INVENTORY },
    cooldownUntil: null,
    activeEffect: null,
  };
}

/**
 * Creates a default match power-up state
 */
export function createDefaultMatchPowerUpState(matchId: string, player1Id: string, player2Id: string): MatchPowerUpState {
  const now = Date.now();
  return {
    matchId,
    player1: createDefaultPlayerPowerUpState(player1Id),
    player2: createDefaultPlayerPowerUpState(player2Id),
    createdAt: now,
    updatedAt: now,
  };
}
