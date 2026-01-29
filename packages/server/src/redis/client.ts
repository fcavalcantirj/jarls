import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`Connecting to Redis at: ${REDIS_URL.replace(/:[^:@]+@/, ':***@')}`);

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 10) {
      console.error('Redis max retries reached, giving up');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 500, 5000);
    console.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  lazyConnect: false,
  connectTimeout: 10000,
  // TLS settings for Upstash
  tls: REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});

redis.on('error', (err: Error) => {
  console.error('Redis client error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis client connected successfully.');
});

redis.on('reconnecting', () => {
  console.log('Redis client reconnecting...');
});

/**
 * Gracefully disconnect the Redis client.
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
}

export { redis };
