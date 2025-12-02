import pool from "../db/connection";
import { leaderboardService as redisLeaderboardService, TimePeriod } from "../redis/leaderboard.service";
import { User } from "../db/types";
import { getRedisClient } from "../redis/connection";

export interface LeaderboardPlayer {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  rating: number;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
  rank: number;
}

export interface LeaderboardResult {
  players: LeaderboardPlayer[];
  total: number;
  period: TimePeriod;
}

// Cache TTL in seconds
const LEADERBOARD_CACHE_TTL = 60; // 1 minute
const SEARCH_CACHE_TTL = 300; // 5 minutes

export class LeaderboardService {
  /**
   * Generate cache key for leaderboard queries
   */
  private getCacheKey(type: string, params: Record<string, any>): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(":");
    return `leaderboard:cache:${type}:${paramStr}`;
  }

  async getGlobalLeaderboard(limit: number = 100, period: TimePeriod = "all-time"): Promise<LeaderboardResult> {
    // Validate limit
    if (limit < 1 || limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }

    // Check cache first
    const cacheKey = this.getCacheKey("global", { limit, period });
    const redis = await getRedisClient();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Get top players from Redis
    const topPlayers = await redisLeaderboardService.getTopPlayers(limit, period);

    if (topPlayers.length === 0) {
      return {
        players: [],
        total: 0,
        period,
      };
    }

    // Get user IDs
    const userIds = topPlayers.map((p) => p.userId);

    // Fetch user details from PostgreSQL
    const result = await pool.query<User>(
      `SELECT id, username, display_name, avatar_url, rating, wins, losses, total_matches
       FROM users
       WHERE id = ANY($1::uuid[])`,
      [userIds]
    );

    // Create a map for quick lookup
    const userMap = new Map<string, User>();
    result.rows.forEach((user) => {
      userMap.set(user.id, user);
    });

    // Combine Redis ranking with PostgreSQL user data
    const players: LeaderboardPlayer[] = topPlayers
      .map((entry) => {
        const user = userMap.get(entry.userId);
        if (!user) return null;

        const winRate = user.total_matches > 0 ? (user.wins / user.total_matches) * 100 : 0;

        return {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          rating: entry.rating,
          wins: user.wins,
          losses: user.losses,
          totalMatches: user.total_matches,
          winRate: Math.round(winRate * 100) / 100,
          rank: entry.rank,
        };
      })
      .filter((player): player is LeaderboardPlayer => player !== null);

    // Get total count
    const total = await redisLeaderboardService.getTotalPlayers(period);

    const leaderboardResult = {
      players,
      total,
      period,
    };

    // Cache the result
    await redis.setEx(cacheKey, LEADERBOARD_CACHE_TTL, JSON.stringify(leaderboardResult));

    return leaderboardResult;
  }

  async searchLeaderboard(username: string, limit: number = 10, period: TimePeriod = "all-time"): Promise<LeaderboardResult> {
    // Validate inputs
    if (!username || username.trim().length === 0) {
      throw new Error("Username search query cannot be empty");
    }

    if (limit < 1 || limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }

    // Check cache first
    const cacheKey = this.getCacheKey("search", { username: username.toLowerCase(), limit, period });
    const redis = await getRedisClient();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Search for users in PostgreSQL by username (case-insensitive partial match)
    const searchResult = await pool.query<User>(
      `SELECT id, username, display_name, avatar_url, rating, wins, losses, total_matches
       FROM users
       WHERE username ILIKE $1
       ORDER BY rating DESC
       LIMIT $2`,
      [`%${username}%`, limit]
    );

    if (searchResult.rows.length === 0) {
      return {
        players: [],
        total: 0,
        period,
      };
    }

    // Get ranks from Redis for found users
    const players: LeaderboardPlayer[] = [];

    for (const user of searchResult.rows) {
      const rank = await redisLeaderboardService.getUserRank(user.id, period);

      // Only include users who are on the leaderboard
      if (rank !== null) {
        const winRate = user.total_matches > 0 ? (user.wins / user.total_matches) * 100 : 0;

        players.push({
          id: user.id,
          username: user.username,
          displayName: user.display_name ?? user.username,
          avatarUrl: user.avatar_url ?? "",
          rating: user.rating,
          wins: user.wins,
          losses: user.losses,
          totalMatches: user.total_matches,
          winRate: Math.round(winRate * 100) / 100,
          rank,
        });
      }
    }

    // Sort by rank
    players.sort((a, b) => a.rank - b.rank);

    const result = {
      players,
      total: players.length,
      period,
    };

    // Cache the result
    await redis.setEx(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result));

    return result;
  }

  /**
   * Invalidate leaderboard cache (call after rating updates)
   */
  async invalidateCache(period?: TimePeriod): Promise<void> {
    const redis = await getRedisClient();
    const patterns = period ? [`leaderboard:cache:global:*period:${period}*`, `leaderboard:cache:search:*period:${period}*`] : ["leaderboard:cache:*"];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    }
  }

  async getUserLeaderboardPosition(userId: string, period: TimePeriod = "all-time"): Promise<LeaderboardPlayer | null> {
    // Get rank from Redis
    const rank = await redisLeaderboardService.getUserRank(userId, period);

    if (rank === null) {
      return null;
    }

    // Get user details from PostgreSQL
    const result = await pool.query<User>(
      `SELECT id, username, display_name, avatar_url, rating, wins, losses, total_matches
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const winRate = user.total_matches > 0 ? (user.wins / user.total_matches) * 100 : 0;

    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name ?? user.username,
      avatarUrl: user.avatar_url ?? "",
      rating: user.rating,
      wins: user.wins,
      losses: user.losses,
      totalMatches: user.total_matches,
      winRate: Math.round(winRate * 100) / 100,
      rank,
    };
  }
}

export const leaderboardService = new LeaderboardService();
