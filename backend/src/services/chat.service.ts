import pool from "../db/connection";
import { SpectatorMessage, NewSpectatorMessage, SpectatorMessageType } from "../db/types";
import { getRedisClient } from "../redis/connection";

/**
 * Enhanced Chat Service
 * Handles spectator chat messages with rate limiting and content filtering
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */

// Rate limit configuration: 1 message per 2 seconds
const CHAT_RATE_LIMIT_WINDOW_MS = 2000;
const CHAT_RATE_LIMIT_KEY_PREFIX = "chat:ratelimit:";

// Blocked words list for content filtering
const BLOCKED_WORDS = [
  "spam",
  "scam",
  "hack",
  "cheat",
  "exploit",
  // Add more inappropriate words as needed
];

// Valid emoji reactions
const VALID_EMOJIS = ["👏", "🔥", "💯", "🎉", "😮", "😂", "🤔", "👀", "❤️", "💪", "🚀", "⭐", "👍", "👎", "😱", "🤯"];

export class ChatService {
  /**
   * Map database row to SpectatorMessage object
   */
  private mapRowToSpectatorMessage(row: any): SpectatorMessage {
    return {
      id: row.id,
      matchId: row.match_id,
      userId: row.user_id,
      username: row.username,
      message: row.message,
      messageType: row.message_type as SpectatorMessageType,
      createdAt: row.created_at,
    };
  }

  /**
   * Get Redis key for rate limiting
   */
  private getRateLimitKey(userId: string): string {
    return `${CHAT_RATE_LIMIT_KEY_PREFIX}${userId}`;
  }

  /**
   * Check rate limit for a user
   * Uses Redis counter with 2-second TTL
   * Returns true if under limit, false otherwise
   * Requirements: 15.4
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    const client = await getRedisClient();
    const key = this.getRateLimitKey(userId);

    // Check if key exists (user sent message recently)
    const exists = await client.exists(key);

    if (exists) {
      // Rate limit exceeded
      return false;
    }

    return true;
  }

  /**
   * Set rate limit for a user after sending a message
   */
  private async setRateLimit(userId: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRateLimitKey(userId);

    // Set key with 2-second TTL
    await client.set(key, "1", { PX: CHAT_RATE_LIMIT_WINDOW_MS });
  }

  /**
   * Get time until rate limit expires (in milliseconds)
   */
  async getRateLimitRetryAfter(userId: string): Promise<number> {
    const client = await getRedisClient();
    const key = this.getRateLimitKey(userId);

    const ttl = await client.pTTL(key);

    if (ttl <= 0) {
      return 0;
    }

    return ttl;
  }

  /**
   * Filter message content for inappropriate words
   * Returns sanitized message or null if message should be rejected
   * Requirements: 15.6
   */
  filterMessage(message: string): string | null {
    if (!message || typeof message !== "string") {
      return null;
    }

    // Trim and check for empty message
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return null;
    }

    // Check message length (max 500 characters)
    if (trimmed.length > 500) {
      return null;
    }

    // Check for blocked words (case-insensitive)
    const lowerMessage = trimmed.toLowerCase();
    for (const word of BLOCKED_WORDS) {
      if (lowerMessage.includes(word.toLowerCase())) {
        // Replace blocked word with asterisks
        const regex = new RegExp(word, "gi");
        return trimmed.replace(regex, "*".repeat(word.length));
      }
    }

    return trimmed;
  }

  /**
   * Validate message content
   */
  private validateMessage(message: string): boolean {
    if (!message || typeof message !== "string") {
      return false;
    }

    const trimmed = message.trim();
    return trimmed.length > 0 && trimmed.length <= 500;
  }

  /**
   * Validate emoji for reactions
   */
  validateEmoji(emoji: string): boolean {
    return VALID_EMOJIS.includes(emoji);
  }

  /**
   * Save message to database
   */
  private async saveMessageToDb(newMessage: NewSpectatorMessage): Promise<SpectatorMessage> {
    const query = `
      INSERT INTO spectator_messages (match_id, user_id, username, message, message_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, match_id, user_id, username, message, message_type, created_at
    `;

    const result = await pool.query(query, [newMessage.matchId, newMessage.userId, newMessage.username, newMessage.message, newMessage.messageType]);

    return this.mapRowToSpectatorMessage(result.rows[0]);
  }

  /**
   * Send a chat message
   * Validates content, checks rate limit, filters inappropriate content,
   * saves to database
   * Requirements: 15.1, 15.4, 15.6
   */
  async sendMessage(matchId: string, userId: string, username: string, message: string): Promise<{ success: boolean; message?: SpectatorMessage; error?: string; retryAfter?: number }> {
    // Validate message content
    if (!this.validateMessage(message)) {
      return { success: false, error: "Invalid message content" };
    }

    // Check rate limit
    const withinLimit = await this.checkRateLimit(userId);
    if (!withinLimit) {
      const retryAfter = await this.getRateLimitRetryAfter(userId);
      return { success: false, error: "Rate limit exceeded", retryAfter };
    }

    // Filter message content
    const filteredMessage = this.filterMessage(message);
    if (filteredMessage === null) {
      return { success: false, error: "Message rejected due to inappropriate content" };
    }

    // Save to database
    const savedMessage = await this.saveMessageToDb({
      matchId,
      userId,
      username,
      message: filteredMessage,
      messageType: "text",
    });

    // Set rate limit after successful send
    await this.setRateLimit(userId);

    return { success: true, message: savedMessage };
  }

  /**
   * Send an emoji reaction
   * Validates emoji and broadcasts to spectators
   * Requirements: 15.3
   */
  async sendReaction(matchId: string, userId: string, username: string, emoji: string): Promise<{ success: boolean; error?: string }> {
    // Validate emoji
    if (!this.validateEmoji(emoji)) {
      return { success: false, error: "Invalid emoji" };
    }

    // Check rate limit (reactions also count toward rate limit)
    const withinLimit = await this.checkRateLimit(userId);
    if (!withinLimit) {
      return { success: false, error: "Rate limit exceeded" };
    }

    // Save reaction to database
    await this.saveMessageToDb({
      matchId,
      userId,
      username,
      message: emoji,
      messageType: "reaction",
    });

    // Set rate limit after successful send
    await this.setRateLimit(userId);

    return { success: true };
  }

  /**
   * Get chat history for a match
   * Returns all messages ordered by creation time
   * Requirements: 15.5
   */
  async getChatHistory(matchId: string): Promise<SpectatorMessage[]> {
    const query = `
      SELECT id, match_id, user_id, username, message, message_type, created_at
      FROM spectator_messages
      WHERE match_id = $1
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [matchId]);

    return result.rows.map((row) => this.mapRowToSpectatorMessage(row));
  }

  /**
   * Get recent chat messages for a match (last N messages)
   */
  async getRecentMessages(matchId: string, limit: number = 50): Promise<SpectatorMessage[]> {
    const query = `
      SELECT id, match_id, user_id, username, message, message_type, created_at
      FROM spectator_messages
      WHERE match_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [matchId, limit]);

    // Reverse to get chronological order
    return result.rows.map((row) => this.mapRowToSpectatorMessage(row)).reverse();
  }

  /**
   * Delete all messages for a match (cleanup)
   */
  async clearChatHistory(matchId: string): Promise<void> {
    const query = `DELETE FROM spectator_messages WHERE match_id = $1`;
    await pool.query(query, [matchId]);
  }

  /**
   * Get message count for a match
   */
  async getMessageCount(matchId: string): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM spectator_messages WHERE match_id = $1`;
    const result = await pool.query(query, [matchId]);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get valid emojis list
   */
  getValidEmojis(): string[] {
    return [...VALID_EMOJIS];
  }

  /**
   * Get blocked words list (for testing/admin purposes)
   */
  getBlockedWords(): string[] {
    return [...BLOCKED_WORDS];
  }
}

// Export singleton instance
export const chatService = new ChatService();
