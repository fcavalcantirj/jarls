#!/bin/sh
set -e

cd /app

# Wait for Postgres to be ready (up to 120 seconds for Railway free tier cold starts)
echo "Waiting for database to be ready..."
MAX_ATTEMPTS=24
ATTEMPT=1
DB_READY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if pnpm --filter @jarls/server exec tsx -e "
    import pg from 'pg';
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    pool.query('SELECT 1').then(() => { console.log('DB ready'); pool.end(); process.exit(0); }).catch((e) => { console.error('DB check failed:', e.message); process.exit(1); });
  " 2>/dev/null; then
    DB_READY=true
    break
  fi
  echo "Database not ready, waiting 5 seconds... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
  ATTEMPT=$((ATTEMPT + 1))
  sleep 5
done

if [ "$DB_READY" = "false" ]; then
  echo "ERROR: Database failed to become ready after $MAX_ATTEMPTS attempts"
  exit 1
fi

echo "Running database migrations..."
pnpm --filter @jarls/server db:migrate || echo "Migration failed or already applied, continuing..."

echo "Starting server..."
exec pnpm --filter @jarls/server exec tsx dist/index.js
