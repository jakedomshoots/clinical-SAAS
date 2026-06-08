#!/bin/bash
# Concierge OS Security Hardening Script
# Run this on production servers to apply security configurations

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

check_pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS_COUNT++)); }
check_warn() { echo -e "${YELLOW}⚠${NC} $1"; ((WARN_COUNT++)); }
check_fail() { echo -e "${RED}✗${NC} $1"; ((FAIL_COUNT++)); }

echo "=== Concierge OS Security Hardening ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Check file permissions
echo "1. Checking file permissions..."
if [ "$(stat -c %a /etc/passwd 2>/dev/null || stat -f %Lp /etc/passwd)" = "644" ]; then
    check_pass "/etc/passwd permissions OK"
else
    check_warn "/etc/passwd permissions may need review"
fi

# 2. Check for world-writable files
echo "2. Checking for world-writable files..."
world_writable=$(find /opt/concierge-os -type f -perm -002 2>/dev/null | wc -l)
if [ "$world_writable" -eq 0 ]; then
    check_pass "No world-writable files found"
else
    check_fail "Found $world_writable world-writable files"
fi

# 3. Check SSH configuration
echo "3. Checking SSH configuration..."
if [ -f /etc/ssh/sshd_config ]; then
    if grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config 2>/dev/null; then
        check_pass "SSH password authentication disabled"
    else
        check_warn "SSH password authentication may be enabled"
    fi
    
    if grep -q "^PermitRootLogin no" /etc/ssh/sshd_config 2>/dev/null; then
        check_pass "SSH root login disabled"
    else
        check_warn "SSH root login may be enabled"
    fi
fi

# 4. Check firewall status
echo "4. Checking firewall..."
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        check_pass "UFW firewall is active"
    else
        check_fail "UFW firewall is not active"
    fi
elif command -v firewall-cmd >/dev/null 2>&1; then
    if firewall-cmd --state 2>/dev/null | grep -q "running"; then
        check_pass "Firewalld is active"
    else
        check_fail "Firewalld is not active"
    fi
else
    check_warn "No firewall detected"
fi

# 5. Check for security updates
echo "5. Checking for security updates..."
if command -v apt >/dev/null 2>&1; then
    updates=$(apt list --upgradable 2>/dev/null | grep -c "security" || true)
    if [ "$updates" -eq 0 ]; then
        check_pass "No security updates available"
    else
        check_warn "$updates security updates available"
    fi
elif command -v yum >/dev/null 2>&1; then
    updates=$(yum --security check-update 2>/dev/null | grep -c "security" || true)
    if [ "$updates" -eq 0 ]; then
        check_pass "No security updates available"
    else
        check_warn "$updates security updates available"
    fi
fi

# 6. Check SSL/TLS configuration
echo "6. Checking SSL/TLS..."
if [ -f /etc/ssl/certs/ca-certificates.crt ]; then
    check_pass "CA certificates installed"
else
    check_warn "CA certificates may be missing"
fi

# 7. Check for failed login attempts
echo "7. Checking for failed logins..."
if [ -f /var/log/auth.log ]; then
    failed=$(grep "Failed password" /var/log/auth.log 2>/dev/null | wc -l)
    if [ "$failed" -lt 10 ]; then
        check_pass "Low failed login attempts ($failed)"
    else
        check_warn "High failed login attempts ($failed)"
    fi
elif [ -f /var/log/secure ]; then
    failed=$(grep "Failed password" /var/log/secure 2>/dev/null | wc -l)
    if [ "$failed" -lt 10 ]; then
        check_pass "Low failed login attempts ($failed)"
    else
        check_warn "High failed login attempts ($failed)"
    fi
fi

# 8. Check environment variables
echo "8. Checking environment variables..."
if [ -f /opt/concierge-os/.env ]; then
    if stat -c %a /opt/concierge-os/.env 2>/dev/null | grep -q "600"; then
        check_pass ".env file has restricted permissions"
    else
        check_fail ".env file permissions too permissive"
    fi
fi

# 9. Check for exposed secrets
echo "9. Checking for exposed secrets..."
secrets_found=$(grep -r "password\|secret\|key\|token" /opt/concierge-os/logs/ 2>/dev/null | wc -l || true)
if [ "$secrets_found" -eq 0 ]; then
    check_pass "No secrets found in logs"
else
    check_fail "Found $secrets_found potential secrets in logs"
fi

# 10. Check application security headers
echo "10. Checking security headers..."
if command -v curl >/dev/null 2>&1; then
    headers=$(curl -sI http://localhost:8000/health 2>/dev/null || true)
    if echo "$headers" | grep -qi "X-Content-Type-Options"; then
        check_pass "X-Content-Type-Options header present"
    else
        check_warn "X-Content-Type-Options header missing"
    fi
    
    if echo "$headers" | grep -qi "X-Frame-Options"; then
        check_pass "X-Frame-Options header present"
    else
        check_warn "X-Frame-Options header missing"
    fi
fi

echo ""
echo "=== Summary ==="
echo -e "${GREEN}PASS:${NC} $PASS_COUNT"
echo -e "${YELLOW}WARN:${NC} $WARN_COUNT"
echo -e "${RED}FAIL:${NC} $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0
