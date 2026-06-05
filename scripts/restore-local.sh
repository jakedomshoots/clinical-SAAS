#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
BACKUP_DIR="${1:-}"

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: pnpm restore:local <backups/YYYYMMDDTHHMMSSZ>" >&2
  exit 1
fi

if [ ! -f "$BACKUP_DIR/postgres.sql" ]; then
  echo "Backup is missing postgres.sql: $BACKUP_DIR" >&2
  exit 1
fi

if [ ! -f "$BACKUP_DIR/minio-concierge-os.tar" ]; then
  echo "Backup is missing minio-concierge-os.tar: $BACKUP_DIR" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to restore local backups" >&2
  exit 1
fi

echo "Restoring local backup from $BACKUP_DIR"
echo "This will replace the local Postgres database and concierge-os MinIO bucket data."

docker compose -f "$COMPOSE_FILE" up -d postgres minio

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U concierge -d concierge_os < "$BACKUP_DIR/postgres.sql"

docker compose -f "$COMPOSE_FILE" exec -T minio sh -lc "rm -rf /data/concierge-os && mkdir -p /data"
docker compose -f "$COMPOSE_FILE" exec -T minio sh -lc "tar -C /data -xf -" \
  < "$BACKUP_DIR/minio-concierge-os.tar"

mkdir -p "$ROOT_DIR/backups"
date -u +"restored_at=%Y%m%dT%H%M%SZ" > "$ROOT_DIR/backups/latest-restore.txt"
echo "restore_source=$BACKUP_DIR" >> "$ROOT_DIR/backups/latest-restore.txt"

echo "Restore complete from $BACKUP_DIR"
