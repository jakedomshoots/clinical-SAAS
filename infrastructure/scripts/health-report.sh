#!/bin/bash
# Concierge OS Health Report Script
# Run this script to check system health before and after deployments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:8000}"
TIMEOUT="${TIMEOUT:-10}"
REPORT_FILE="${REPORT_FILE:-health-report-$(date +%Y%m%d-%H%M%S).json}"

# Results storage
declare -a CHECKS=()
declare -a STATUSES=()
declare -a MESSAGES=()

add_check() {
    local name="$1"
    local status="$2"
    local message="$3"
    CHECKS+=("$name")
    STATUSES+=("$status")
    MESSAGES+=("$message")
}

print_status() {
    local status="$1"
    local message="$2"
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $message"
    else
        echo -e "${RED}✗${NC} $message"
    fi
}

echo "=== Concierge OS Health Report ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "API URL: $API_URL"
echo ""

# 1. API Health Check
echo "Checking API health..."
if response=$(curl -sf --max-time "$TIMEOUT" "$API_URL/health" 2>/dev/null); then
    add_check "api_health" "PASS" "API is responding"
    print_status "PASS" "API health endpoint responding"
else
    add_check "api_health" "FAIL" "API is not responding"
    print_status "FAIL" "API health endpoint not responding"
fi

# 2. Database Connectivity
echo "Checking database..."
if response=$(curl -sf --max-time "$TIMEOUT" "$API_URL/health/db" 2>/dev/null); then
    add_check "database" "PASS" "Database connection OK"
    print_status "PASS" "Database connection OK"
else
    add_check "database" "FAIL" "Database connection failed"
    print_status "FAIL" "Database connection failed"
fi

# 3. Cache Connectivity
echo "Checking cache..."
if response=$(curl -sf --max-time "$TIMEOUT" "$API_URL/health/cache" 2>/dev/null); then
    add_check "cache" "PASS" "Cache connection OK"
    print_status "PASS" "Cache connection OK"
else
    add_check "cache" "FAIL" "Cache connection failed"
    print_status "FAIL" "Cache connection failed"
fi

# 4. Object Storage
echo "Checking object storage..."
if response=$(curl -sf --max-time "$TIMEOUT" "$API_URL/health/storage" 2>/dev/null); then
    add_check "storage" "PASS" "Object storage OK"
    print_status "PASS" "Object storage OK"
else
    add_check "storage" "FAIL" "Object storage failed"
    print_status "FAIL" "Object storage failed"
fi

# 5. Integration Health
echo "Checking integrations..."
if response=$(curl -sf --max-time "$TIMEOUT" "$API_URL/admin/integrations/health" 2>/dev/null); then
    # Count healthy integrations
    healthy_count=$(echo "$response" | grep -o '"healthy":true' | wc -l)
    total_count=$(echo "$response" | grep -o '"key"' | wc -l)
    
    if [ "$healthy_count" -eq "$total_count" ]; then
        add_check "integrations" "PASS" "All $total_count integrations healthy"
        print_status "PASS" "All $total_count integrations healthy"
    else
        add_check "integrations" "WARN" "$healthy_count/$total_count integrations healthy"
        print_status "WARN" "$healthy_count/$total_count integrations healthy"
    fi
else
    add_check "integrations" "FAIL" "Cannot check integration health"
    print_status "FAIL" "Cannot check integration health"
fi

# 6. Disk Space
echo "Checking disk space..."
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk_usage" -lt 80 ]; then
    add_check "disk_space" "PASS" "Disk usage: ${disk_usage}%"
    print_status "PASS" "Disk usage: ${disk_usage}%"
elif [ "$disk_usage" -lt 90 ]; then
    add_check "disk_space" "WARN" "Disk usage: ${disk_usage}%"
    print_status "WARN" "Disk usage: ${disk_usage}%"
else
    add_check "disk_space" "FAIL" "Disk usage critical: ${disk_usage}%"
    print_status "FAIL" "Disk usage critical: ${disk_usage}%"
fi

# 7. Memory
echo "Checking memory..."
if command -v free >/dev/null 2>&1; then
    memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ "$memory_usage" -lt 80 ]; then
        add_check "memory" "PASS" "Memory usage: ${memory_usage}%"
        print_status "PASS" "Memory usage: ${memory_usage}%"
    elif [ "$memory_usage" -lt 90 ]; then
        add_check "memory" "WARN" "Memory usage: ${memory_usage}%"
        print_status "WARN" "Memory usage: ${memory_usage}%"
    else
        add_check "memory" "FAIL" "Memory usage critical: ${memory_usage}%"
        print_status "FAIL" "Memory usage critical: ${memory_usage}%"
    fi
else
    add_check "memory" "WARN" "Cannot check memory (free not available)"
    print_status "WARN" "Cannot check memory"
fi

# 8. SSL Certificate (if HTTPS)
if [[ "$API_URL" == https* ]]; then
    echo "Checking SSL certificate..."
    host=$(echo "$API_URL" | sed 's|https://||' | sed 's|/.*||')
    if echo | openssl s_client -connect "$host:443" -servername "$host" 2>/dev/null | openssl x509 -noout -checkend 86400 >/dev/null 2>&1; then
        add_check "ssl" "PASS" "SSL certificate valid for >24h"
        print_status "PASS" "SSL certificate valid for >24h"
    else
        add_check "ssl" "WARN" "SSL certificate expiring soon or invalid"
        print_status "WARN" "SSL certificate expiring soon or invalid"
    fi
fi

# Generate JSON report
echo ""
echo "Generating report..."

# Count results
pass_count=0
warn_count=0
fail_count=0

for status in "${STATUSES[@]}"; do
    case "$status" in
        PASS) ((pass_count++)) ;;
        WARN) ((warn_count++)) ;;
        FAIL) ((fail_count++)) ;;
    esac
done

# Build JSON
cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "api_url": "$API_URL",
  "summary": {
    "total": ${#CHECKS[@]},
    "pass": $pass_count,
    "warn": $warn_count,
    "fail": $fail_count,
    "healthy": $([ "$fail_count" -eq 0 ] && echo "true" || echo "false")
  },
  "checks": [
EOF

# Add checks
for i in "${!CHECKS[@]}"; do
    comma=$([ "$i" -lt $((${#CHECKS[@]} - 1)) ] && echo "," || echo "")
    cat >> "$REPORT_FILE" <<EOF
    {
      "name": "${CHECKS[$i]}",
      "status": "${STATUSES[$i]}",
      "message": "${MESSAGES[$i]}"
    }$comma
EOF
done

cat >> "$REPORT_FILE" <<EOF
  ]
}
EOF

echo ""
echo "=== Summary ==="
echo -e "${GREEN}PASS:${NC} $pass_count"
echo -e "${YELLOW}WARN:${NC} $warn_count"
echo -e "${RED}FAIL:${NC} $fail_count"
echo ""
echo "Report saved to: $REPORT_FILE"

# Exit with error if any checks failed
if [ "$fail_count" -gt 0 ]; then
    exit 1
fi

exit 0
