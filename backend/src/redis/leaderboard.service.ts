import { getRedisClient } from "./connection";

export interface LeaderboardEntry {
  userId: string;
  rating: number;
  rank: number;
}

export type TimePeriod = "daily" | "weekly" | "all-time";

export class LeaderboardService {
  private getLeaderboardKey(period: TimePeriod = "all-time"): string {
    return `leaderboard:${period}`;
  }

  async updateUserRating(userId: string, rating: number, period: TimePeriod = "all-time"): Promise<void> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    // Add or update user in sorted set with rating as score
    await client.zAdd(key, {
      score: rating,
      value: userId,
    });

    // Set TTL for time-based leaderboards
    if (period === "daily") {
      await client.expire(key, 86400); // 24 hours
    } else if (period === "weekly") {
      await client.expire(key, 604800); // 7 days
    }
  }

  async getUserRank(userId: string, period: TimePeriod = "all-time"): Promise<number | null> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    // Get rank (0-indexed, descending order)
    const rank = await client.zRevRank(key, userId);

    return rank !== null ? rank + 1 : null; // Convert to 1-indexed
  }

  async getUserRating(userId: string, period: TimePeriod = "all-time"): Promise<number | null> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    const rating = await client.zScore(key, userId);

    return rating !== null ? rating : null;
  }

  async getTopPlayers(limit: number = 100, period: TimePeriod = "all-time"): Promise<LeaderboardEntry[]> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    // Get top players with scores (descending order)
    const results = await client.zRangeWithScores(key, 0, limit - 1, {
      REV: true,
    });

    return results.map((result, index) => ({
      userId: result.value,
      rating: result.score,
      rank: index + 1,
    }));
  }

  async getPlayersInRange(start: number, end: number, period: TimePeriod = "all-time"): Promise<LeaderboardEntry[]> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    // Convert to 0-indexed
    const startIdx = start - 1;
    const endIdx = end - 1;

    const results = await client.zRangeWithScores(key, startIdx, endIdx, {
      REV: true,
    });

    return results.map((result, index) => ({
      userId: result.value,
      rating: result.score,
      rank: startIdx + index + 1,
    }));
  }

  async getTotalPlayers(period: TimePeriod = "all-time"): Promise<number> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    return await client.zCard(key);
  }

  async removeUser(userId: string, period: TimePeriod = "all-time"): Promise<void> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    await client.zRem(key, userId);
  }

  async getPlayersAbove(userId: string, count: number = 5, period: TimePeriod = "all-time"): Promise<LeaderboardEntry[]> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    const userRank = await client.zRevRank(key, userId);

    if (userRank === null) {
      return [];
    }

    const start = Math.max(0, userRank - count);
    const end = userRank - 1;

    if (start > end) {
      return [];
    }

    const results = await client.zRangeWithScores(key, start, end, {
      REV: true,
    });

    return results.map((result, index) => ({
      userId: result.value,
      rating: result.score,
      rank: start + index + 1,
    }));
  }

  async getPlayersBelow(userId: string, count: number = 5, period: TimePeriod = "all-time"): Promise<LeaderboardEntry[]> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    const userRank = await client.zRevRank(key, userId);

    if (userRank === null) {
      return [];
    }

    const start = userRank + 1;
    const end = userRank + count;

    const results = await client.zRangeWithScores(key, start, end, {
      REV: true,
    });

    return results.map((result, index) => ({
      userId: result.value,
      rating: result.score,
      rank: start + index + 1,
    }));
  }

  async clearLeaderboard(period: TimePeriod = "all-time"): Promise<void> {
    const client = await getRedisClient();
    const key = this.getLeaderboardKey(period);

    await client.del(key);
  }
}

export const leaderboardService = new LeaderboardService();
