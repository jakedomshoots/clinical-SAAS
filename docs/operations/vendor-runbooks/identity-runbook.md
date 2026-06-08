# Identity Provider Integration Runbook

## Overview

Staff authentication, MFA, and role-based access control via Auth0.

## Vendor Information

- **Vendor**: Auth0
- **API Documentation**: https://auth0.com/docs/api/management/v2
- **Support Contact**: https://support.auth0.com
- **BAA Status**: Enterprise plan includes BAA

## Environment Variables

```bash
AUTH0_API_KEY=***
AUTH0_DOMAIN=your-clinic.us.auth0.com
AUTH0_CLIENT_ID=***
AUTH0_CLIENT_SECRET=***
```

## Account Setup

1. Sign up at https://auth0.com/
2. Create a tenant for your clinic
3. Configure Universal Login page
4. Enable MFA (TOTP/SMS)
5. Request BAA for HIPAA compliance
6. Create roles: provider, nurse, front_desk, billing, admin

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/auth0/health
```

## Common Operations

### 1. Create Staff User

```bash
curl -X POST https://api.concierge-os.example.com/integrations/auth0/users \
  -H "Authorization: Bearer *** \
  -d '{
    "email": "jane.doe@clinic.com",
    "name": "Jane Doe, MD",
    "roles": ["provider"],
    "send_verification": true
  }'
```

### 2. Update User Roles

```bash
curl -X PATCH https://api.concierge-os.example.com/integrations/auth0/users/USER-ID/roles \
  -H "Authorization: Bearer *** \
  -d '{"roles": ["provider", "admin"]}'
```

### 3. List Staff

```bash
curl "https://api.concierge-os.example.com/integrations/auth0/users?role=provider&limit=50" \
  -H "Authorization: Bearer *** Troubleshooting

### Issue: Login fails

**Symptoms**: Staff can't log in.

**Resolution**:
```bash
# Check Auth0 tenant status
grep "auth0" /var/log/concierge-os/app.log | grep "error"

# Verify user exists and is not blocked
grep "auth0" /var/log/concierge-os/app.log | grep "user"
```

### Issue: MFA not working

**Symptoms**: MFA prompt not appearing.

**Resolution**:
```bash
# Check MFA policy in Auth0 dashboard
# Verify user has enrolled MFA device
# Check if rule is bypassing MFA for certain IPs
```

## Rollback

```bash
# Disable Auth0 SSO (fallback to local auth)
curl -X POST https://api.concierge-os.example.com/admin/integrations/auth0/maintenance \
  -d '{"enabled": false}'
```
