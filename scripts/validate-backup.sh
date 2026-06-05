#!/usr/bin/env sh
set -eu

BACKUP_DIR="${1:-}"

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: pnpm backup:validate <backups/YYYYMMDDTHHMMSSZ>" >&2
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

for file in manifest.txt postgres.sql minio-concierge-os.tar; do
  if [ ! -f "$BACKUP_DIR/$file" ]; then
    echo "Missing backup file: $file" >&2
    exit 1
  fi
done

if [ ! -s "$BACKUP_DIR/postgres.sql" ]; then
  echo "postgres.sql is empty" >&2
  exit 1
fi

if [ ! -s "$BACKUP_DIR/manifest.txt" ]; then
  echo "manifest.txt is empty" >&2
  exit 1
fi

if ! grep -q '^created_at=' "$BACKUP_DIR/manifest.txt"; then
  echo "manifest.txt is missing created_at" >&2
  exit 1
fi

echo "Backup is structurally valid: $BACKUP_DIR"
