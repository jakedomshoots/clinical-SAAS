# Patient Portal Integration Runbook

## Overview

Patient portal for secure messaging, intake forms, and document access.

## Vendor Information

- **Vendor**: [To be configured - custom or third-party]
- **API Documentation**: [To be configured]
- **Support Contact**: [To be configured]

## Environment Variables

```bash
PORTAL_API_BASE_URL=https://portal.concierge-os.example.com
PORTAL_API_KEY=***
```

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/portal/health
```

## Common Operations

### 1. Send Portal Message

```bash
curl -X POST https://api.concierge-os.example.com/integrations/portal/messages \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "patient-123",
    "subject": "Test results available",
    "body": "Your lab results are ready for review."
  }'
```

## Troubleshooting

### Issue: Portal messages not sending

**Resolution**:

```bash
grep "portal" /var/log/concierge-os/app.log | grep "error"
```

## Rollback

```bash
curl -X POST https://api.concierge-os.example.com/admin/integrations/portal/maintenance \
  -d '{"enabled": false}'
```
