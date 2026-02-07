#!/bin/sh
set -e

echo "Running database migrations..."
node /app/backend/dist/scripts/migrate.js

echo "Starting application..."
exec pm2-runtime start /app/ecosystem.config.js
