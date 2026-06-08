# EHR Integration Runbook

## Overview

Integration with external Electronic Health Record systems for patient data sync, medication reconciliation, and encounter writeback.

## Vendor Information

- **Vendor**: [To be configured]
- **API Documentation**: [To be configured]
- **Support Contact**: [To be configured]
- **Escalation Contact**: [To be configured]
- **BAA Status**: [Pending]

## Environment Variables

```bash
EHR_API_BASE_URL=https://api.ehr-vendor.com/v1
EHR_API_KEY=***
EHR_API_SECRET=***
EHR_WEBHOOK_SECRET=***
```

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/ehr/health
```

Expected response:
```json
{
  "integration": "ehr",
  "health": {
    "ok": true,
    "configured": true,
    "mode": "production_vendor",
    "adapter_implemented": true
  }
}
```

## Common Operations

### 1. Test Patient Search

```bash
curl -X POST https://api.concierge-os.example.com/integrations/ehr/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"operation": "search_patient", "query": "Test Patient"}'
```

### 2. Sync Single Patient

```bash
curl -X POST https://api.concierge-os.example.com/integrations/ehr/sync \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"patient_id": "patient-123", "direction": "pull"}'
```

### 3. Check Sync Status

```bash
curl https://api.concierge-os.example.com/integrations/ehr/sync/status \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Issue: Patient search returns no results

**Symptoms**: Search queries return empty results for known patients.

**Diagnosis**:
1. Check EHR API credentials are valid
2. Verify patient exists in EHR system
3. Check search parameters match EHR format

**Resolution**:
```bash
# Test direct API access
curl -H "Authorization: Bearer $EHR_API_KEY" \
  "$EHR_API_BASE_URL/patients?search=Test"

# Check logs
grep "ehr" /var/log/concierge-os/app.log | tail -50
```

### Issue: Sync failures

**Symptoms**: Patient data not updating between systems.

**Diagnosis**:
1. Check webhook delivery status
2. Verify patient mapping exists
3. Check for API rate limiting

**Resolution**:
```bash
# Check webhook logs
grep "webhook" /var/log/concierge-os/app.log | grep "ehr"

# Retry failed sync
curl -X POST https://api.concierge-os.example.com/integrations/ehr/sync/retry \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: Authentication errors

**Symptoms**: 401/403 errors from EHR API.

**Diagnosis**:
1. Check API key expiration
2. Verify IP whitelist
3. Check OAuth token refresh

**Resolution**:
```bash
# Rotate API key (requires admin)
curl -X POST https://api.concierge-os.example.com/admin/integrations/ehr/rotate-key \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Rollback Procedures

### Disable EHR Integration

```bash
# Put integration in maintenance mode
curl -X POST https://api.concierge-os.example.com/admin/integrations/ehr/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false, "reason": "Vendor outage"}'
```

### Re-enable EHR Integration

```bash
curl -X POST https://api.concierge-os.example.com/admin/integrations/ehr/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true}'
```

## Monitoring

### Key Metrics

- Patient sync success rate
- API response time (p50, p99)
- Webhook delivery rate
- Error rate by endpoint

### Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| EHR API Down | Health check fails 3x | Page on-call |
| High Error Rate | >5% errors in 5min | Notify team |
| Sync Lag | >15min since last sync | Investigate |
| Auth Failure | Any 401/403 | Check credentials |

## Maintenance Windows

- **Planned maintenance**: Coordinate with vendor
- **Emergency maintenance**: Follow incident response procedure
- **Testing window**: Use sandbox environment

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Primary Owner | [TBD] | [TBD] |
| Technical Lead | [TBD] | [TBD] |
| Vendor Support | [TBD] | [TBD] |
| Escalation | [TBD] | [TBD] |
