#!/bin/sh
set -e

cd /app

# Wait for Postgres to be ready (up to 30 seconds)
echo "Waiting for database to be ready..."
for i in 1 2 3 4 5 6; do
  if pnpm --filter @jarls/server exec tsx -e "
    import pg from 'pg';
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    pool.query('SELECT 1').then(() => { console.log('DB ready'); pool.end(); process.exit(0); }).catch(() => process.exit(1));
  " 2>/dev/null; then
    break
  fi
  echo "Database not ready, waiting 5 seconds... (attempt $i/6)"
  sleep 5
done

echo "Running database migrations..."
pnpm --filter @jarls/server db:migrate || echo "Migration failed or already applied, continuing..."

echo "Starting server..."
exec pnpm --filter @jarls/server exec tsx dist/index.js
