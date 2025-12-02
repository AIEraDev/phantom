import { getRedisClient } from "./connection";

export interface QueueEntry {
  userId: string;
  timestamp: number;
  rating: number;
}

export class MatchmakingService {
  private getQueueKey(difficulty?: string, language?: string): string {
    const diff = difficulty || "any";
    const lang = language || "any";
    return `queue:${diff}:${lang}`;
  }

  async addToQueue(userId: string, rating: number, difficulty?: string, language?: string): Promise<number> {
    const client = await getRedisClient();
    const key = this.getQueueKey(difficulty, language);
    const timestamp = Date.now();

    // Add user to sorted set with timestamp as score (FIFO)
    await client.zAdd(key, {
      score: timestamp,
      value: JSON.stringify({ userId, rating, timestamp }),
    });

    // Get position in queue (0-indexed)
    const position = await client.zRank(key, JSON.stringify({ userId, rating, timestamp }));

    return position !== null ? position + 1 : 1;
  }

  async removeFromQueue(userId: string, difficulty?: string, language?: string): Promise<boolean> {
    const client = await getRedisClient();
    const key = this.getQueueKey(difficulty, language);

    // Find and remove all entries for this user
    const members = await client.zRange(key, 0, -1);
    let removed = false;

    for (const member of members) {
      try {
        const entry = JSON.parse(member);
        if (entry.userId === userId) {
          await client.zRem(key, member);
          removed = true;
        }
      } catch (err) {
        console.error("Error parsing queue member:", err);
      }
    }

    return removed;
  }

  async removeFromAllQueues(userId: string): Promise<void> {
    const client = await getRedisClient();
    const pattern = "queue:*";

    // Get all queue keys
    const keys = await client.keys(pattern);

    for (const key of keys) {
      const members = await client.zRange(key, 0, -1);

      for (const member of members) {
        try {
          const entry = JSON.parse(member);
          if (entry.userId === userId) {
            await client.zRem(key, member);
          }
        } catch (err) {
          console.error("Error parsing queue member:", err);
        }
      }
    }
  }

  async getQueuePosition(userId: string, difficulty?: string, language?: string): Promise<number | null> {
    const client = await getRedisClient();
    const key = this.getQueueKey(difficulty, language);

    const members = await client.zRange(key, 0, -1);

    for (let i = 0; i < members.length; i++) {
      try {
        const entry = JSON.parse(members[i]);
        if (entry.userId === userId) {
          return i + 1; // 1-indexed position
        }
      } catch (err) {
        console.error("Error parsing queue member:", err);
      }
    }

    return null;
  }

  async getQueueSize(difficulty?: string, language?: string): Promise<number> {
    const client = await getRedisClient();
    const key = this.getQueueKey(difficulty, language);

    return await client.zCard(key);
  }

  async findMatch(difficulty?: string, language?: string, ratingRange: number = 100): Promise<QueueEntry[] | null> {
    const client = await getRedisClient();
    const key = this.getQueueKey(difficulty, language);

    // Get all users in queue (sorted by timestamp)
    const members = await client.zRange(key, 0, -1);

    if (members.length < 2) {
      return null;
    }

    // Parse entries
    const entries: QueueEntry[] = [];
    for (const member of members) {
      try {
        const entry = JSON.parse(member);
        entries.push(entry);
      } catch (err) {
        console.error("Error parsing queue member:", err);
      }
    }

    // Find first pair with ratings within range
    for (let i = 0; i < entries.length - 1; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const ratingDiff = Math.abs(entries[i].rating - entries[j].rating);
        if (ratingDiff <= ratingRange) {
          return [entries[i], entries[j]];
        }
      }
    }

    return null;
  }

  async removePairFromQueue(pair: QueueEntry[], difficulty?: string, language?: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getQueueKey(difficulty, language);

    // Get all members and find matching entries by userId
    const members = await client.zRange(key, 0, -1);

    for (const member of members) {
      try {
        const entry = JSON.parse(member);
        // Check if this member matches any user in the pair
        if (pair.some((p) => p.userId === entry.userId)) {
          await client.zRem(key, member);
        }
      } catch (err) {
        console.error("Error parsing queue member during removal:", err);
      }
    }
  }

  async getEstimatedWaitTime(userId: string, difficulty?: string, language?: string): Promise<number> {
    const position = await this.getQueuePosition(userId, difficulty, language);
    const queueSize = await this.getQueueSize(difficulty, language);

    if (!position || queueSize < 2) {
      return 30; // Default 30 seconds
    }

    // Estimate: 2 seconds per position (assuming matches are made every 2 seconds)
    return Math.max(position * 2, 5);
  }

  async clearQueue(difficulty?: string, language?: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getQueueKey(difficulty, language);

    await client.del(key);
  }
}

export const matchmakingService = new MatchmakingService();
