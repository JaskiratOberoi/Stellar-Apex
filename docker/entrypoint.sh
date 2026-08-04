#!/bin/bash
set -e

echo "[entrypoint] waiting for database ${DB_HOST}:${DB_PORT}..."
until php -r '
  $h=getenv("DB_HOST"); $p=getenv("DB_PORT"); $d=getenv("DB_NAME");
  $u=getenv("DB_USER"); $w=getenv("DB_PASSWORD");
  try { new PDO("mysql:host=$h;port=$p;dbname=$d", $u, $w); exit(0); }
  catch (Throwable $e) { exit(1); }
'; do
  echo "[entrypoint] db not ready, retrying in 2s..."
  sleep 2
done
echo "[entrypoint] database is ready."

# Roster seeding (idempotent; reference data + users come from MySQL init).
#   SEED_MODE=demo   -> dev demo roster (several fake employees)
#   SEED_MODE=sample -> exactly 1 Noble sample record (for a clean prod start)
#   SEED_MODE=none   -> seed nothing (prod ships empty)
SEED_MODE="${SEED_MODE:-demo}"
case "$SEED_MODE" in
  demo)   php /var/www/html/api/tools/seed-demo.php   || echo "[entrypoint] demo seed skipped (non-fatal)" ;;
  sample) php /var/www/html/api/tools/seed-sample.php || echo "[entrypoint] sample seed skipped (non-fatal)" ;;
  none)   echo "[entrypoint] SEED_MODE=none, not seeding employees" ;;
  *)      echo "[entrypoint] unknown SEED_MODE=$SEED_MODE, skipping" ;;
esac

exec "$@"
