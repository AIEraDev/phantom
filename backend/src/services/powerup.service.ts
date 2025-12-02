import { powerUpStateManager } from "../redis/powerUpState.service";
import { matchStateService } from "../redis/matchState.service";
import { PowerUpType, PlayerPowerUpState, MatchPowerUpState, PowerUpActivationResult, CooldownCheckResult, DebugShieldStatus, ActivePowerUpEffect, createDefaultMatchPowerUpState, POWERUP_COOLDOWN_MS, TIME_FREEZE_DURATION_MS, DEBUG_SHIELD_CHARGES } from "../types/powerups";

/**
 * PowerUpService - Core service managing power-up logic and state transitions
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1-2.5, 3.1-3.5, 4.1-4.5, 6.1-6.4
 */
export class PowerUpService {
  /**
   * Initialize power-ups for a new match
   * Allocates 1 of each power-up to both players
   * Requirements: 1.1, 1.2
   */
  async initializePowerUps(matchId: string, player1Id: string, player2Id: string): Promise<void> {
    const state = createDefaultMatchPowerUpState(matchId, player1Id, player2Id);
    await powerUpStateManager.setPowerUpState(matchId, state);
  }

  /**
   * Get current power-up state for a player
   * Requirements: 1.3
   */
  async getPlayerPowerUps(matchId: string, playerId: string): Promise<PlayerPowerUpState | null> {
    const state = await powerUpStateManager.getPowerUpState(matchId);
    if (!state) {
      return null;
    }

    if (state.player1.playerId === playerId) {
      return state.player1;
    } else if (state.player2.playerId === playerId) {
      return state.player2;
    }

    return null;
  }

  /**
   * Get power-up state for entire match
   * Requirements: 1.3
   */
  async getMatchPowerUpState(matchId: string): Promise<MatchPowerUpState | null> {
    return powerUpStateManager.getPowerUpState(matchId);
  }

  /**
   * Check if player can use a power-up (cooldown check)
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  async canUsePowerUp(matchId: string, playerId: string): Promise<CooldownCheckResult> {
    const playerState = await this.getPlayerPowerUps(matchId, playerId);
    if (!playerState) {
      return { canUse: false, cooldownRemaining: 0 };
    }

    const now = Date.now();
    if (playerState.cooldownUntil && playerState.cooldownUntil > now) {
      return {
        canUse: false,
        cooldownRemaining: playerState.cooldownUntil - now,
      };
    }

    return { canUse: true, cooldownRemaining: 0 };
  }

  /**
   * Activate Time Freeze for a player
   * Requirements: 2.1, 2.2, 2.3
   */
  private async activateTimeFreeze(matchId: string, playerId: string, _playerState: PlayerPowerUpState): Promise<PowerUpActivationResult> {
    const now = Date.now();
    const freezeExpiresAt = now + TIME_FREEZE_DURATION_MS;

    const effect: ActivePowerUpEffect = {
      type: "time_freeze",
      activatedAt: now,
      expiresAt: freezeExpiresAt,
    };

    await powerUpStateManager.updateActiveEffect(matchId, playerId, effect);

    const updatedState = await this.getPlayerPowerUps(matchId, playerId);

    return {
      success: true,
      newState: updatedState || undefined,
      freezeExpiresAt,
    };
  }

  /**
   * Calculate effective time remaining for a player (accounts for Time Freeze)
   * Requirements: 2.1, 2.2, 2.3
   */
  async calculateEffectiveTimeRemaining(matchId: string, playerId: string, baseTimeRemaining: number): Promise<number> {
    const playerState = await this.getPlayerPowerUps(matchId, playerId);
    if (!playerState || !playerState.activeEffect) {
      return baseTimeRemaining;
    }

    if (playerState.activeEffect.type !== "time_freeze") {
      return baseTimeRemaining;
    }

    const now = Date.now();
    const effect = playerState.activeEffect;

    // If freeze is still active, add remaining freeze time to base time
    if (effect.expiresAt > now) {
      const remainingFreezeTime = effect.expiresAt - now;
      return baseTimeRemaining + remainingFreezeTime;
    }

    return baseTimeRemaining;
  }

  /**
   * Activate Code Peek for a player
   * Requirements: 3.1, 3.2
   */
  private async activateCodePeek(matchId: string, playerId: string, _playerState: PlayerPowerUpState): Promise<PowerUpActivationResult> {
    // Get match state to find opponent's code
    const matchState = await matchStateService.getMatch(matchId);
    if (!matchState) {
      return {
        success: false,
        error: "Match not found",
        errorCode: "MATCH_NOT_FOUND",
      };
    }

    // Determine opponent and get their code
    const isPlayer1 = matchState.player1Id === playerId;
    const opponentCode = isPlayer1 ? matchState.player2Code : matchState.player1Code;

    const now = Date.now();
    const effect: ActivePowerUpEffect = {
      type: "code_peek",
      activatedAt: now,
      expiresAt: now + 5000, // 5 seconds display time
    };

    await powerUpStateManager.updateActiveEffect(matchId, playerId, effect);

    const updatedState = await this.getPlayerPowerUps(matchId, playerId);

    return {
      success: true,
      newState: updatedState || undefined,
      opponentCode,
    };
  }

  /**
   * Activate Debug Shield for a player
   * Requirements: 4.1, 4.2
   */
  private async activateDebugShield(matchId: string, playerId: string, _playerState: PlayerPowerUpState): Promise<PowerUpActivationResult> {
    const now = Date.now();

    const effect: ActivePowerUpEffect = {
      type: "debug_shield",
      activatedAt: now,
      expiresAt: 0, // Debug shield doesn't expire by time
      remainingCharges: DEBUG_SHIELD_CHARGES,
    };

    await powerUpStateManager.updateActiveEffect(matchId, playerId, effect);

    const updatedState = await this.getPlayerPowerUps(matchId, playerId);

    return {
      success: true,
      newState: updatedState || undefined,
      shieldedRunsRemaining: DEBUG_SHIELD_CHARGES,
    };
  }

  /**
   * Consume a Debug Shield charge (called on test run)
   * Requirements: 4.2, 4.3
   */
  async consumeDebugShieldCharge(matchId: string, playerId: string): Promise<DebugShieldStatus> {
    const playerState = await this.getPlayerPowerUps(matchId, playerId);

    if (!playerState || !playerState.activeEffect) {
      return { isActive: false, remainingCharges: 0, wasConsumed: false };
    }

    if (playerState.activeEffect.type !== "debug_shield") {
      return { isActive: false, remainingCharges: 0, wasConsumed: false };
    }

    const currentCharges = playerState.activeEffect.remainingCharges || 0;
    if (currentCharges <= 0) {
      return { isActive: false, remainingCharges: 0, wasConsumed: false };
    }

    const newCharges = currentCharges - 1;

    if (newCharges <= 0) {
      // Deactivate shield when charges reach 0
      await powerUpStateManager.updateActiveEffect(matchId, playerId, null);
      return { isActive: false, remainingCharges: 0, wasConsumed: true };
    }

    // Update remaining charges
    const updatedEffect: ActivePowerUpEffect = {
      ...playerState.activeEffect,
      remainingCharges: newCharges,
    };
    await powerUpStateManager.updateActiveEffect(matchId, playerId, updatedEffect);

    return { isActive: true, remainingCharges: newCharges, wasConsumed: true };
  }

  /**
   * Unified method to activate any power-up
   * Routes to specific activation method based on power-up type
   * Requirements: 1.4, 2.5, 3.5, 4.5
   */
  async activatePowerUp(matchId: string, playerId: string, powerUpType: PowerUpType): Promise<PowerUpActivationResult> {
    // Get current player state
    const playerState = await this.getPlayerPowerUps(matchId, playerId);
    if (!playerState) {
      return {
        success: false,
        error: "Player not found in match",
        errorCode: "UNAUTHORIZED",
      };
    }

    // Check cooldown
    const cooldownCheck = await this.canUsePowerUp(matchId, playerId);
    if (!cooldownCheck.canUse) {
      return {
        success: false,
        error: "Power-up on cooldown",
        errorCode: "ON_COOLDOWN",
        cooldownRemaining: cooldownCheck.cooldownRemaining,
      };
    }

    // Check inventory
    const inventoryCount = this.getInventoryCount(playerState, powerUpType);
    if (inventoryCount <= 0) {
      return {
        success: false,
        error: "No power-up available",
        errorCode: "NO_POWERUP",
      };
    }

    // Decrement inventory
    await this.decrementInventory(matchId, playerId, playerState, powerUpType);

    // Start cooldown
    const cooldownUntil = Date.now() + POWERUP_COOLDOWN_MS;
    await powerUpStateManager.updateCooldown(matchId, playerId, cooldownUntil);

    // Activate specific power-up
    let result: PowerUpActivationResult;
    switch (powerUpType) {
      case "time_freeze":
        result = await this.activateTimeFreeze(matchId, playerId, playerState);
        break;
      case "code_peek":
        result = await this.activateCodePeek(matchId, playerId, playerState);
        break;
      case "debug_shield":
        result = await this.activateDebugShield(matchId, playerId, playerState);
        break;
      default:
        return {
          success: false,
          error: "Invalid power-up type",
          errorCode: "INVALID_TYPE",
        };
    }

    // Get updated state after activation
    if (result.success) {
      result.newState = (await this.getPlayerPowerUps(matchId, playerId)) || undefined;
    }

    return result;
  }

  /**
   * Get inventory count for a specific power-up type
   */
  private getInventoryCount(playerState: PlayerPowerUpState, powerUpType: PowerUpType): number {
    switch (powerUpType) {
      case "time_freeze":
        return playerState.inventory.timeFreeze;
      case "code_peek":
        return playerState.inventory.codePeek;
      case "debug_shield":
        return playerState.inventory.debugShield;
      default:
        return 0;
    }
  }

  /**
   * Decrement inventory for a specific power-up type
   */
  private async decrementInventory(matchId: string, playerId: string, playerState: PlayerPowerUpState, powerUpType: PowerUpType): Promise<void> {
    const newInventory = { ...playerState.inventory };

    switch (powerUpType) {
      case "time_freeze":
        newInventory.timeFreeze = Math.max(0, newInventory.timeFreeze - 1);
        break;
      case "code_peek":
        newInventory.codePeek = Math.max(0, newInventory.codePeek - 1);
        break;
      case "debug_shield":
        newInventory.debugShield = Math.max(0, newInventory.debugShield - 1);
        break;
    }

    await powerUpStateManager.updatePlayerInventory(matchId, playerId, newInventory);
  }
}

export const powerUpService = new PowerUpService();
