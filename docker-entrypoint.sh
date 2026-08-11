#!/bin/sh
set -e

echo "==> Applying database migrations to ${DATABASE_URL}"
npx prisma migrate deploy

echo "==> Starting 3D Model Aggregator on port ${PORT:-3000}"
exec "$@"
