import { getRedisClient } from "./connection";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimitService {
  private getRateLimitKey(identifier: string, endpoint: string): string {
    return `ratelimit:${identifier}:${endpoint}`;
  }

  async checkRateLimit(identifier: string, endpoint: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const client = await getRedisClient();
    const key = this.getRateLimitKey(identifier, endpoint);
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    // Get current count
    const current = await client.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= config.maxRequests) {
      // Rate limit exceeded
      const ttl = await client.ttl(key);
      const resetAt = Date.now() + ttl * 1000;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Increment counter
    const newCount = await client.incr(key);

    // Set expiry on first request
    if (newCount === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttl = await client.ttl(key);
    const resetAt = Date.now() + ttl * 1000;

    return {
      allowed: true,
      remaining: config.maxRequests - newCount,
      resetAt,
    };
  }

  async resetRateLimit(identifier: string, endpoint: string): Promise<void> {
    const client = await getRedisClient();
    const key = this.getRateLimitKey(identifier, endpoint);

    await client.del(key);
  }

  async getRemainingRequests(identifier: string, endpoint: string, maxRequests: number): Promise<number> {
    const client = await getRedisClient();
    const key = this.getRateLimitKey(identifier, endpoint);

    const current = await client.get(key);
    const count = current ? parseInt(current) : 0;

    return Math.max(0, maxRequests - count);
  }

  async getResetTime(identifier: string, endpoint: string): Promise<number | null> {
    const client = await getRedisClient();
    const key = this.getRateLimitKey(identifier, endpoint);

    const ttl = await client.ttl(key);

    if (ttl === -2) {
      // Key doesn't exist
      return null;
    }

    if (ttl === -1) {
      // Key exists but has no expiry
      return null;
    }

    return Date.now() + ttl * 1000;
  }
}

export const rateLimitService = new RateLimitService();

// Predefined rate limit configurations
export const RATE_LIMITS = {
  AUTH: {
    maxRequests: 5,
    windowMs: 60000, // 1 minute
  },
  CODE_EXECUTION: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
  },
  CLAUDE_API: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
  GENERAL_API: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
} as const;
