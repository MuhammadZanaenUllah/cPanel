#!/bin/sh
set -e

echo "[entrypoint] Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
until nc -z "${DB_HOST:-mysql}" "${DB_PORT:-3306}" 2>/dev/null; do
  sleep 2
done
echo "[entrypoint] MySQL is up."

# Small extra delay for MySQL to finish init on first run
sleep 3

cd /app/packages/api

echo "[entrypoint] Running migrations..."
node -e "
const knex = require('knex');
const cfg = require('./dist/knexfile.js');
const db = knex(cfg.production !== undefined ? cfg.production : (cfg.default ? cfg.default.production : cfg));
db.migrate.latest()
  .then(() => { console.log('Migrations done'); return db.seed.run(); })
  .then(() => { console.log('Seeds done'); return db.destroy(); })
  .then(() => process.exit(0))
  .catch(err => { console.error('Migration/seed error:', err.message); db.destroy(); process.exit(0); });
" || true

echo "[entrypoint] Starting API..."
exec node dist/server.js
