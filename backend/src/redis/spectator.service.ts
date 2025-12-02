import { getRedisClient } from "./connection";

export interface SpectatorInfo {
  userId: string;
  username: string;
  joinedAt: number;
}

const SPECTATOR_TTL = 3600; // 1 hour in seconds

export class SpectatorService {
  private getSpectatorSetKey(matchId: string): string {
    return `spectators:${matchId}`;
  }

  /**
   * Add a spectator to a match
   */
  async addSpectator(matchId: string, userId: string, username: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getSpectatorSetKey(matchId);

    const spectatorInfo: SpectatorInfo = {
      userId,
      username,
      joinedAt: Date.now(),
    };

    await client.sAdd(key, JSON.stringify(spectatorInfo));
    await client.expire(key, SPECTATOR_TTL);
  }

  /**
   * Remove a spectator from a match
   */
  async removeSpectator(matchId: string, userId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getSpectatorSetKey(matchId);

    // Get all members and find the one with matching userId
    const members = await client.sMembers(key);

    for (const member of members) {
      try {
        const spectator = JSON.parse(member);
        if (spectator.userId === userId) {
          await client.sRem(key, member);
          console.log(`Removed spectator ${userId} from match ${matchId}`);
          return;
        }
      } catch (err) {
        console.error("Error parsing spectator member:", err);
      }
    }
  }

  /**
   * Get all spectators for a match
   */
  async getSpectators(matchId: string): Promise<SpectatorInfo[]> {
    const client = await getRedisClient();
    const key = this.getSpectatorSetKey(matchId);

    const members = await client.sMembers(key);

    return members.map((member) => JSON.parse(member));
  }

  /**
   * Get spectator count for a match
   */
  async getSpectatorCount(matchId: string): Promise<number> {
    const client = await getRedisClient();
    const key = this.getSpectatorSetKey(matchId);

    return await client.sCard(key);
  }

  /**
   * Check if a user is spectating a match
   */
  async isSpectating(matchId: string, userId: string): Promise<boolean> {
    const spectators = await this.getSpectators(matchId);
    return spectators.some((s) => s.userId === userId);
  }

  /**
   * Remove all spectators from a match (cleanup)
   */
  async clearSpectators(matchId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getSpectatorSetKey(matchId);

    await client.del(key);
  }
}

export const spectatorService = new SpectatorService();
