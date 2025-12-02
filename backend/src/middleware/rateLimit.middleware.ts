import { Request, Response, NextFunction } from "express";
import { rateLimitService, RateLimitConfig } from "../redis/rateLimit.service";

export interface RateLimitOptions {
  config: RateLimitConfig;
  keyGenerator?: (req: Request) => string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
}

/**
 * Rate limiting middleware factory
 * Creates middleware that enforces rate limits using Redis
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const { config, keyGenerator, skipFailedRequests = false, skipSuccessfulRequests = false } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Generate identifier (default to IP address or user ID if authenticated)
      const identifier = keyGenerator ? keyGenerator(req) : (req as any).user?.id || req.ip || req.socket.remoteAddress || "unknown";

      // Generate endpoint key from route path
      const endpoint = req.route?.path || req.path;

      // Check rate limit
      const result = await rateLimitService.checkRateLimit(identifier, endpoint, config);

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", config.maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
      res.setHeader("X-RateLimit-Reset", new Date(result.resetAt).toISOString());

      if (!result.allowed) {
        // Calculate retry-after in seconds
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

        res.setHeader("Retry-After", retryAfter.toString());

        res.status(429).json({
          error: "Too many requests",
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
          resetAt: new Date(result.resetAt).toISOString(),
        });

        return;
      }

      // If we should skip counting on failed/successful requests, track the response
      if (skipFailedRequests || skipSuccessfulRequests) {
        const originalSend = res.send;

        res.send = function (data: any): Response {
          const statusCode = res.statusCode;
          const shouldSkip = (skipFailedRequests && statusCode >= 400) || (skipSuccessfulRequests && statusCode < 400);

          if (shouldSkip) {
            // Decrement the counter since we're skipping this request
            rateLimitService.checkRateLimit(identifier, endpoint, { ...config, maxRequests: config.maxRequests + 1 });
          }

          return originalSend.call(this, data);
        };
      }

      next();
    } catch (error) {
      // If rate limiting fails, log error but allow request through
      console.error("Rate limiting error:", error);
      next();
    }
  };
}

/**
 * Rate limit middleware for authentication endpoints
 * 5 requests per minute
 */
export const authRateLimit = createRateLimitMiddleware({
  config: {
    maxRequests: 5,
    windowMs: 60000, // 1 minute
  },
  keyGenerator: (req) => {
    // Use email or IP for auth endpoints
    return req.body?.email || req.ip || req.socket.remoteAddress || "unknown";
  },
});

/**
 * Rate limit middleware for code execution endpoints
 * 10 requests per minute per user
 */
export const codeExecutionRateLimit = createRateLimitMiddleware({
  config: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
  },
  keyGenerator: (req) => {
    // Use authenticated user ID
    return (req as any).user?.id || req.ip || "unknown";
  },
  skipFailedRequests: true, // Don't count failed executions
});

/**
 * Rate limit middleware for Claude API calls
 * 100 requests per minute per user
 */
export const claudeApiRateLimit = createRateLimitMiddleware({
  config: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
  keyGenerator: (req) => {
    // Use authenticated user ID
    return (req as any).user?.id || "system";
  },
});

/**
 * General API rate limit
 * 100 requests per minute per user/IP
 */
export const generalApiRateLimit = createRateLimitMiddleware({
  config: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
  keyGenerator: (req) => {
    return (req as any).user?.id || req.ip || req.socket.remoteAddress || "unknown";
  },
});
