#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_ROOT/$STAMP"

mkdir -p "$DEST"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run local backups" >&2
  exit 1
fi

echo "Writing backup to $DEST"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U concierge -d concierge_os --clean --if-exists > "$DEST/postgres.sql"

docker compose -f "$COMPOSE_FILE" exec -T minio sh -lc \
  "tar -C /data -cf - concierge-os 2>/dev/null || true" > "$DEST/minio-concierge-os.tar"

cat > "$DEST/manifest.txt" <<EOF
created_at=$STAMP
compose_file=$COMPOSE_FILE
postgres_dump=postgres.sql
object_archive=minio-concierge-os.tar
EOF

cp "$DEST/manifest.txt" "$BACKUP_ROOT/latest-manifest.txt"

echo "Backup complete: $DEST"
