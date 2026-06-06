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

ARCHIVE="$BACKUP_DIR/minio-concierge-os.tar"
MEMBERS_FILE="$(mktemp)"
LISTING_FILE="$(mktemp)"
trap 'rm -f "$MEMBERS_FILE" "$LISTING_FILE"' EXIT

if ! tar -tf "$ARCHIVE" > "$MEMBERS_FILE"; then
  echo "minio-concierge-os.tar cannot be listed" >&2
  exit 1
fi

while IFS= read -r member; do
  [ -n "$member" ] || continue
  case "$member" in
    /*|../*|*/../*|..|*/..)
      echo "Unsafe tar member path: $member" >&2
      exit 1
      ;;
  esac
  case "$member" in
    concierge-os|concierge-os/*)
      ;;
    *)
      echo "Unexpected tar member outside concierge-os bucket: $member" >&2
      exit 1
      ;;
  esac
done < "$MEMBERS_FILE"

if ! tar -tvf "$ARCHIVE" > "$LISTING_FILE"; then
  echo "minio-concierge-os.tar cannot be inspected" >&2
  exit 1
fi

while IFS= read -r line; do
  type_char="$(printf '%s' "$line" | cut -c1)"
  case "$type_char" in
    -|d)
      ;;
    *)
      echo "Unsafe tar member type: $line" >&2
      exit 1
      ;;
  esac
done < "$LISTING_FILE"

echo "Backup is structurally valid: $BACKUP_DIR"
