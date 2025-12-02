import { getRedisClient } from "./connection";
import { MatchPowerUpState, PlayerPowerUpState, PowerUpInventory, ActivePowerUpEffect } from "../types/powerups";

const MATCH_TTL = 3600; // 1 hour in seconds (same as match TTL)

/**
 * PowerUpStateManager handles Redis storage for power-up state
 * Requirements: 1.2, 8.1, 8.2, 9.1, 9.2
 */
export class PowerUpStateManager {
  private getPowerUpKey(matchId: string): string {
    return `match:${matchId}:powerups`;
  }

  /**
   * Store complete power-up state in Redis
   * Requirements: 9.1 - Serialize inventory to JSON format
   */
  async setPowerUpState(matchId: string, state: MatchPowerUpState): Promise<void> {
    const client = await getRedisClient();
    const key = this.getPowerUpKey(matchId);

    await client.hSet(key, {
      player1State: JSON.stringify(state.player1),
      player2State: JSON.stringify(state.player2),
      matchId: state.matchId,
      createdAt: state.createdAt.toString(),
      updatedAt: Date.now().toString(),
    });

    await client.expire(key, MATCH_TTL);
  }

  /**
   * Retrieve power-up state from Redis
   * Requirements: 9.2 - Deserialize JSON back to inventory data structure
   */
  async getPowerUpState(matchId: string): Promise<MatchPowerUpState | null> {
    const client = await getRedisClient();
    const key = this.getPowerUpKey(matchId);

    const data = await client.hGetAll(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      matchId: data.matchId,
      player1: JSON.parse(data.player1State) as PlayerPowerUpState,
      player2: JSON.parse(data.player2State) as PlayerPowerUpState,
      createdAt: parseInt(data.createdAt),
      updatedAt: parseInt(data.updatedAt),
    };
  }

  /**
   * Update a specific player's power-up inventory
   * Requirements: 1.2 - Store power-up inventory in match state
   */
  async updatePlayerInventory(matchId: string, playerId: string, inventory: PowerUpInventory): Promise<void> {
    const state = await this.getPowerUpState(matchId);
    if (!state) {
      throw new Error("Power-up state not found for match");
    }

    const isPlayer1 = state.player1.playerId === playerId;
    const playerState = isPlayer1 ? state.player1 : state.player2;

    playerState.inventory = inventory;

    const client = await getRedisClient();
    const key = this.getPowerUpKey(matchId);
    const stateField = isPlayer1 ? "player1State" : "player2State";

    await client.hSet(key, {
      [stateField]: JSON.stringify(playerState),
      updatedAt: Date.now().toString(),
    });
  }

  /**
   * Update cooldown timestamp for a player
   * Requirements: 8.2 - Restore active power-up effects with correct remaining duration
   */
  async updateCooldown(matchId: string, playerId: string, cooldownUntil: number | null): Promise<void> {
    const state = await this.getPowerUpState(matchId);
    if (!state) {
      throw new Error("Power-up state not found for match");
    }

    const isPlayer1 = state.player1.playerId === playerId;
    const playerState = isPlayer1 ? state.player1 : state.player2;

    playerState.cooldownUntil = cooldownUntil;

    const client = await getRedisClient();
    const key = this.getPowerUpKey(matchId);
    const stateField = isPlayer1 ? "player1State" : "player2State";

    await client.hSet(key, {
      [stateField]: JSON.stringify(playerState),
      updatedAt: Date.now().toString(),
    });
  }

  /**
   * Update active effect state for a player
   * Requirements: 8.1, 8.2 - Restore player's power-up inventory and active effects
   */
  async updateActiveEffect(matchId: string, playerId: string, effect: ActivePowerUpEffect | null): Promise<void> {
    const state = await this.getPowerUpState(matchId);
    if (!state) {
      throw new Error("Power-up state not found for match");
    }

    const isPlayer1 = state.player1.playerId === playerId;
    const playerState = isPlayer1 ? state.player1 : state.player2;

    playerState.activeEffect = effect;

    const client = await getRedisClient();
    const key = this.getPowerUpKey(matchId);
    const stateField = isPlayer1 ? "player1State" : "player2State";

    await client.hSet(key, {
      [stateField]: JSON.stringify(playerState),
      updatedAt: Date.now().toString(),
    });
  }

  /**
   * Delete power-up state for a match
   */
  async deletePowerUpState(matchId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getPowerUpKey(matchId);
    await client.del(key);
  }

  /**
   * Extend TTL for power-up state
   */
  async extendPowerUpStateTTL(matchId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getPowerUpKey(matchId);
    await client.expire(key, MATCH_TTL);
  }
}

export const powerUpStateManager = new PowerUpStateManager();
