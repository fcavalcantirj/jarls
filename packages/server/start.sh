#!/bin/sh
set -e

cd /app

echo "Running database migrations..."
pnpm --filter @jarls/server db:migrate || echo "Migration failed or already applied, continuing..."

echo "Starting server..."
exec pnpm --filter @jarls/server exec tsx dist/index.js
