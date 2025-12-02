import { getRedisClient } from "./connection";
import { GhostEvent } from "../db/types";

/**
 * Ghost Race State stored in Redis
 * Requirements: 14.2, 14.3
 */
export interface GhostRaceState {
  raceId: string;
  playerId: string;
  ghostId: string;
  challengeId: string;
  status: "waiting" | "active" | "completed" | "abandoned";
  startedAt: number;
  ghostDurationMs: number;
  ghostScore: number;
  ghostEvents: GhostEvent[];
  currentGhostEventIndex: number;
  playerCode: string;
  playerCursor: { line: number; column: number };
  playerSubmitted: boolean;
  playerSubmittedAt?: number;
  playerScore?: number;
}

const GHOST_RACE_TTL = 3600; // 1 hour in seconds

/**
 * Ghost Race State Service
 * Manages active ghost race state in Redis
 * Requirements: 14.2, 14.3
 */
export class GhostRaceStateService {
  private getRaceKey(raceId: string): string {
    return `ghost_race:${raceId}`;
  }

  private getPlayerRaceKey(playerId: string): string {
    return `ghost_race:player:${playerId}`;
  }

  /**
   * Create a new ghost race state
   */
  async createRace(state: GhostRaceState): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRaceKey(state.raceId);
    const playerKey = this.getPlayerRaceKey(state.playerId);

    await client.hSet(key, {
      raceId: state.raceId,
      playerId: state.playerId,
      ghostId: state.ghostId,
      challengeId: state.challengeId,
      status: state.status,
      startedAt: state.startedAt.toString(),
      ghostDurationMs: state.ghostDurationMs.toString(),
      ghostScore: state.ghostScore.toString(),
      ghostEvents: JSON.stringify(state.ghostEvents),
      currentGhostEventIndex: state.currentGhostEventIndex.toString(),
      playerCode: state.playerCode,
      playerCursor: JSON.stringify(state.playerCursor),
      playerSubmitted: state.playerSubmitted.toString(),
      playerSubmittedAt: state.playerSubmittedAt?.toString() || "",
      playerScore: state.playerScore?.toString() || "",
    });

    // Map player to race for quick lookup
    await client.set(playerKey, state.raceId);

    await client.expire(key, GHOST_RACE_TTL);
    await client.expire(playerKey, GHOST_RACE_TTL);
  }

  /**
   * Get ghost race state by race ID
   */
  async getRace(raceId: string): Promise<GhostRaceState | null> {
    const client = await getRedisClient();
    const key = this.getRaceKey(raceId);

    const data = await client.hGetAll(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      raceId: data.raceId,
      playerId: data.playerId,
      ghostId: data.ghostId,
      challengeId: data.challengeId,
      status: data.status as GhostRaceState["status"],
      startedAt: parseInt(data.startedAt),
      ghostDurationMs: parseInt(data.ghostDurationMs),
      ghostScore: parseInt(data.ghostScore),
      ghostEvents: JSON.parse(data.ghostEvents),
      currentGhostEventIndex: parseInt(data.currentGhostEventIndex),
      playerCode: data.playerCode,
      playerCursor: JSON.parse(data.playerCursor),
      playerSubmitted: data.playerSubmitted === "true",
      playerSubmittedAt: data.playerSubmittedAt ? parseInt(data.playerSubmittedAt) : undefined,
      playerScore: data.playerScore ? parseInt(data.playerScore) : undefined,
    };
  }

  /**
   * Get race ID for a player
   */
  async getPlayerRaceId(playerId: string): Promise<string | null> {
    const client = await getRedisClient();
    const playerKey = this.getPlayerRaceKey(playerId);
    return client.get(playerKey);
  }

  /**
   * Update ghost event index (for playback tracking)
   */
  async updateGhostEventIndex(raceId: string, index: number): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRaceKey(raceId);
    await client.hSet(key, "currentGhostEventIndex", index.toString());
  }

  /**
   * Update player code during race
   */
  async updatePlayerCode(raceId: string, code: string, cursor: { line: number; column: number }): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRaceKey(raceId);

    await client.hSet(key, {
      playerCode: code,
      playerCursor: JSON.stringify(cursor),
    });
  }

  /**
   * Mark player as submitted
   */
  async markPlayerSubmitted(raceId: string, score: number): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRaceKey(raceId);

    await client.hSet(key, {
      playerSubmitted: "true",
      playerSubmittedAt: Date.now().toString(),
      playerScore: score.toString(),
    });
  }

  /**
   * Update race status
   */
  async updateRaceStatus(raceId: string, status: GhostRaceState["status"]): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRaceKey(raceId);
    await client.hSet(key, "status", status);
  }

  /**
   * Delete ghost race state
   */
  async deleteRace(raceId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRaceKey(raceId);

    // Get player ID to clean up player mapping
    const race = await this.getRace(raceId);
    if (race) {
      const playerKey = this.getPlayerRaceKey(race.playerId);
      await client.del(playerKey);
    }

    await client.del(key);
  }

  /**
   * Extend race TTL
   */
  async extendRaceTTL(raceId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRaceKey(raceId);
    await client.expire(key, GHOST_RACE_TTL);
  }

  /**
   * Get events that should be played back up to a given timestamp
   * Returns events from currentGhostEventIndex to the event at or before timestamp
   */
  async getEventsToPlayback(raceId: string, currentTimestamp: number): Promise<{ events: GhostEvent[]; newIndex: number } | null> {
    const race = await this.getRace(raceId);
    if (!race) return null;

    const events: GhostEvent[] = [];
    let newIndex = race.currentGhostEventIndex;

    // Find all events that should have been played by now
    for (let i = race.currentGhostEventIndex; i < race.ghostEvents.length; i++) {
      const event = race.ghostEvents[i];
      if (event.timestamp <= currentTimestamp) {
        events.push(event);
        newIndex = i + 1;
      } else {
        break;
      }
    }

    return { events, newIndex };
  }

  /**
   * Check if ghost playback is complete
   */
  async isGhostPlaybackComplete(raceId: string): Promise<boolean> {
    const race = await this.getRace(raceId);
    if (!race) return true;

    return race.currentGhostEventIndex >= race.ghostEvents.length;
  }
}

export const ghostRaceStateService = new GhostRaceStateService();
