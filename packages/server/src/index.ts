// @jarls/server entry point

import { env } from './config/env.js';

// Import database and redis to initialize connections
import './db/pool.js';
import './redis/client.js';

import { createServer, gameManager } from './server.js';

const { httpServer } = createServer();

// Recover active games from database on startup
gameManager
  .recover()
  .then(() => {
    console.log(`Recovered ${gameManager.gameCount} active game(s) from database.`);
  })
  .catch((err) => {
    console.error('Failed to recover games from database:', err);
  });

// Start listening
httpServer.listen(env.PORT, () => {
  console.log(`Jarls server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  // Stop accepting new connections
  httpServer.close(() => {
    console.log('HTTP server closed.');
  });

  try {
    // Shutdown game manager (stops all actors)
    await gameManager.shutdown();
    console.log('Game manager shut down.');

    // Close database pool
    const { closePool } = await import('./db/pool.js');
    await closePool();
    console.log('Database pool closed.');

    // Close Redis connection
    const { closeRedis } = await import('./redis/client.js');
    await closeRedis();
    console.log('Redis connection closed.');
  } catch (err) {
    console.error('Error during shutdown:', err);
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
