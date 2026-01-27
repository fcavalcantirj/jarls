import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: false,
});

redis.on('error', (err: Error) => {
  console.error('Redis client error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis client connected.');
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

function handleShutdown(signal: string) {
  console.log(`Received ${signal}. Closing Redis connection...`);
  redis
    .quit()
    .then(() => {
      console.log('Redis connection closed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error closing Redis connection:', err);
      process.exit(1);
    });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export { redis };
