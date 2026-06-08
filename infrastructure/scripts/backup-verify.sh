#!/bin/bash
# Concierge OS Backup Verification Script
# Verifies database backups are valid and restorable

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${DB_NAME:-concierge_os}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
VERIFY_DB="${VERIFY_DB:-concierge_os_verify}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
REPORT_FILE="${REPORT_FILE:-backup-report-$(date +%Y%m%d-%H%M%S).json}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Concierge OS Backup Verification ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Backup Directory: $BACKUP_DIR"
echo ""

# Find latest backup
latest_backup=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)

if [ -z "$latest_backup" ]; then
    echo -e "${RED}✗${NC} No backups found in $BACKUP_DIR"
    exit 1
fi

echo "Latest backup: $latest_backup"
echo "Backup size: $(du -h "$latest_backup" | cut -f1)"
echo "Backup age: $(find "$latest_backup" -mtime +1 | wc -l | sed 's/1/\>24h/;s/0/\<24h/')"
echo ""

# Verify backup file integrity
echo "Verifying backup file integrity..."
if gunzip -t "$latest_backup" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Backup file is valid gzip"
    file_valid=true
else
    echo -e "${RED}✗${NC} Backup file is corrupted"
    file_valid=false
fi

# Test restore to verification database
echo ""
echo "Testing restore to verification database..."

# Drop verification database if exists
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $VERIFY_DB;" 2>/dev/null || true

# Create verification database
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE $VERIFY_DB;" 2>/dev/null || true

# Restore backup
if zcat "$latest_backup" | psql -h "$DB_HOST" -U "$DB_USER" -d "$VERIFY_DB" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Restore successful"
    restore_valid=true
else
    echo -e "${RED}✗${NC} Restore failed"
    restore_valid=false
fi

# Verify restored data
echo ""
echo "Verifying restored data..."

if [ "$restore_valid" = true ]; then
    # Check table counts
    table_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$VERIFY_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs)
    echo "Tables restored: $table_count"
    
    # Check for critical tables
    critical_tables=("patients" "appointments" "users" "audit_logs")
    all_present=true
    
    for table in "${critical_tables[@]}"; do
        exists=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$VERIFY_DB" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='$table');" 2>/dev/null | xargs)
        if [ "$exists" = "t" ]; then
            echo -e "${GREEN}✓${NC} Table '$table' exists"
        else
            echo -e "${YELLOW}⚠${NC} Table '$table' missing"
            all_present=false
        fi
    done
    
    # Check row counts in critical tables
    for table in "${critical_tables[@]}"; do
        count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$VERIFY_DB" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
        echo "  $table: $count rows"
    done
    
    # Verify indexes
    index_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$VERIFY_DB" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';" 2>/dev/null | xargs)
    echo "Indexes restored: $index_count"
    
    # Clean up verification database
    psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE $VERIFY_DB;" 2>/dev/null || true
fi

# Check backup retention
echo ""
echo "Checking backup retention..."
old_backups=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS 2>/dev/null)
if [ -n "$old_backups" ]; then
    old_count=$(echo "$old_backups" | wc -l)
    echo -e "${YELLOW}⚠${NC} $old_count backups older than $RETENTION_DAYS days"
else
    echo -e "${GREEN}✓${NC} No old backups to purge"
fi

# Generate report
cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backup_file": "$latest_backup",
  "backup_size": "$(du -h "$latest_backup" | cut -f1)",
  "file_valid": $file_valid,
  "restore_valid": $restore_valid,
  "tables_restored": ${table_count:-0},
  "indexes_restored": ${index_count:-0},
  "healthy": $([ "$file_valid" = true ] && [ "$restore_valid" = true ] && echo "true" || echo "false")
}
EOF

echo ""
echo "Report saved to: $REPORT_FILE"

# Exit with error if verification failed
if [ "$file_valid" != true ] || [ "$restore_valid" != true ]; then
    exit 1
fi

exit 0
