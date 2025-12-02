import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error("Redis: Max reconnection attempts reached");
          return new Error("Max reconnection attempts reached");
        }
        // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
        const delay = Math.min(50 * Math.pow(2, retries), 3000);
        console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries + 1})`);
        return delay;
      },
    },
  });

  redisClient.on("error", (err) => {
    console.error("Redis Client Error:", err);
  });

  redisClient.on("connect", () => {
    console.log("Redis: Connected");
  });

  redisClient.on("ready", () => {
    console.log("Redis: Ready to accept commands");
  });

  redisClient.on("reconnecting", () => {
    console.log("Redis: Reconnecting...");
  });

  redisClient.on("end", () => {
    console.log("Redis: Connection closed");
  });

  await redisClient.connect();

  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    console.log("Redis: Connection closed gracefully");
  }
}

export function isRedisConnected(): boolean {
  return redisClient !== null && redisClient.isOpen;
}
