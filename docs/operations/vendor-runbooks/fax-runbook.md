# Fax Integration Runbook

## Overview

HIPAA-compliant fax sending and receiving via SRFax.

## Vendor Information

- **Vendor**: SRFax
- **API Documentation**: https://www.srfax.com/api/
- **Support Contact**: https://www.srfax.com/support
- **HIPAA Compliance**: BAA included with healthcare plans

## Environment Variables

```bash
SRFAX_API_KEY=***
SRFAX_ACCESS_ID=your-srfax-username
```

## Account Setup

1. Sign up at https://www.srfax.com/
2. Choose a healthcare plan (includes BAA)
3. Get your Access ID (username) and generate API password
4. Configure inbound fax webhook URL

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/srfax/health
```

## Common Operations

### 1. Send Fax

```bash
curl -X POST https://api.concierge-os.example.com/integrations/srfax/faxes \
  -H "Authorization: Bearer ***" \
  -d '{
    "to_number": "+15551234567",
    "file_content": "base64-encoded-pdf",
    "file_name": "referral.pdf",
    "cover_page": "Patient referral from Concierge OS",
    "patient_id": "patient-123"
  }'
```

### 2. Check Fax Status

```bash
curl https://api.concierge-os.example.com/integrations/srfax/faxes/FAX-ID/status \
  -H "Authorization: Bearer ***"
```

### 3. List Inbound Faxes

```bash
curl "https://api.concierge-os.example.com/integrations/srfax/inbox?start_date=2026-06-01&limit=20" \
  -H "Authorization: Bearer ***"
```

### 4. Download Received Fax

```bash
curl https://api.concierge-os.example.com/integrations/srfax/inbox/FAX-ID/download \
  -H "Authorization: Bearer ***" \
  --output received_fax.pdf
```

## Troubleshooting

### Issue: Fax not sending

**Symptoms**: Fax stays in queue or fails.

**Resolution**:
```bash
# Check SRFax status
grep "srfax" /var/log/concierge-os/app.log | grep "error"

# Verify recipient number is a valid fax
grep "srfax" /var/log/concierge-os/app.log | grep "invalid"
```

### Issue: Inbound faxes not appearing

**Symptoms**: Received faxes not in system.

**Resolution**:
```bash
# Check webhook delivery
grep "srfax" /var/log/concierge-os/app.log | grep "webhook"

# Verify inbound routing in SRFax portal
```

## Rollback

```bash
# Disable fax integration
curl -X POST https://api.concierge-os.example.com/admin/integrations/srfax/maintenance \
  -d '{"enabled": false}'
```
