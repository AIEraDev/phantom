import pool from "../db/connection";
import { User } from "../db/types";

export interface UserStats {
  rating: number;
  wins: number;
  losses: number;
  totalMatches: number;
  winRate: number;
}

export interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string;
}

export interface UserMatchSummary {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  player1Score: number | null;
  player2Score: number | null;
  player1Language: string;
  player2Language: string;
  duration: number | null;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  challenge: {
    id: string;
    title: string;
    difficulty: string;
  } | null;
  opponent: {
    id: string;
    username: string;
    rating: number;
  };
}

export interface PaginatedMatches {
  matches: UserMatchSummary[];
  total: number;
  limit: number;
  offset: number;
}

export class UserService {
  async getUserById(userId: string): Promise<Omit<User, "password_hash"> | null> {
    const result = await pool.query<User>(
      `SELECT id, email, username, display_name, avatar_url, rating, wins, losses, total_matches, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Omit<User, "password_hash">> {
    const { displayName, avatarUrl } = input;

    // Validate input
    if (displayName !== undefined) {
      this.validateDisplayName(displayName);
    }

    if (avatarUrl !== undefined) {
      this.validateAvatarUrl(avatarUrl);
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount}`);
      values.push(displayName);
      paramCount++;
    }

    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatarUrl);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);

    // Add userId as last parameter
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id, email, username, display_name, avatar_url, rating, wins, losses, total_matches, created_at, updated_at
    `;

    const result = await pool.query<User>(query, values);

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const result = await pool.query<User>(
      `SELECT rating, wins, losses, total_matches
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = result.rows[0];
    const winRate = user.total_matches > 0 ? (user.wins / user.total_matches) * 100 : 0;

    return {
      rating: user.rating,
      wins: user.wins,
      losses: user.losses,
      totalMatches: user.total_matches,
      winRate: Math.round(winRate * 100) / 100, // Round to 2 decimal places
    };
  }

  async getUserMatches(userId: string, limit: number = 10, offset: number = 0): Promise<PaginatedMatches> {
    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }

    if (offset < 0) {
      throw new Error("Offset must be non-negative");
    }

    // Get total count
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM matches
       WHERE player1_id = $1 OR player2_id = $1`,
      [userId]
    );

    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated matches with challenge and opponent info
    const matchesResult = await pool.query(
      `SELECT 
        m.*,
        c.id as challenge_id,
        c.title as challenge_title,
        c.difficulty as challenge_difficulty,
        u1.id as p1_id,
        u1.username as p1_username,
        u1.rating as p1_rating,
        u2.id as p2_id,
        u2.username as p2_username,
        u2.rating as p2_rating
       FROM matches m
       LEFT JOIN challenges c ON m.challenge_id = c.id
       LEFT JOIN users u1 ON m.player1_id = u1.id
       LEFT JOIN users u2 ON m.player2_id = u2.id
       WHERE m.player1_id = $1 OR m.player2_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Transform results to include nested objects
    const matches = matchesResult.rows.map((row: any) => {
      const isPlayer1 = row.player1_id === userId;
      return {
        id: row.id,
        challengeId: row.challenge_id,
        player1Id: row.player1_id,
        player2Id: row.player2_id,
        winnerId: row.winner_id,
        player1Score: row.player1_score,
        player2Score: row.player2_score,
        player1Language: row.player1_language,
        player2Language: row.player2_language,
        duration: row.duration,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        challenge: row.challenge_title
          ? {
              id: row.challenge_id,
              title: row.challenge_title,
              difficulty: row.challenge_difficulty,
            }
          : null,
        opponent: {
          id: isPlayer1 ? row.p2_id : row.p1_id,
          username: isPlayer1 ? row.p2_username : row.p1_username,
          rating: isPlayer1 ? row.p2_rating : row.p1_rating,
        },
      };
    });

    return {
      matches,
      total,
      limit,
      offset,
    };
  }

  private validateDisplayName(displayName: string): void {
    if (displayName.length === 0) {
      throw new Error("Display name cannot be empty");
    }

    if (displayName.length > 50) {
      throw new Error("Display name must be 50 characters or less");
    }

    // Allow letters, numbers, spaces, and common punctuation
    const displayNameRegex = /^[a-zA-Z0-9\s\-_.,']+$/;
    if (!displayNameRegex.test(displayName)) {
      throw new Error("Display name contains invalid characters");
    }
  }

  private validateAvatarUrl(avatarUrl: string): void {
    if (avatarUrl.length === 0) {
      throw new Error("Avatar URL cannot be empty");
    }

    // Check if it's a base64 data URL (for uploaded images)
    if (avatarUrl.startsWith("data:image/")) {
      // Validate base64 data URL format
      const dataUrlRegex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
      if (!dataUrlRegex.test(avatarUrl)) {
        throw new Error("Invalid image data format");
      }
      // Limit base64 image size to ~2MB (base64 is ~33% larger than binary)
      if (avatarUrl.length > 2.7 * 1024 * 1024) {
        throw new Error("Image is too large. Maximum size is 2MB");
      }
      return;
    }

    // For regular URLs, apply stricter length limit
    if (avatarUrl.length > 500) {
      throw new Error("Avatar URL is too long");
    }

    // Basic URL validation
    try {
      const url = new URL(avatarUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Avatar URL must use HTTP or HTTPS protocol");
      }
    } catch (error) {
      // Check if it's a protocol error by trying to parse with http://
      if (avatarUrl.includes("://")) {
        throw new Error("Avatar URL must use HTTP or HTTPS protocol");
      }
      throw new Error("Invalid avatar URL format");
    }
  }
}
