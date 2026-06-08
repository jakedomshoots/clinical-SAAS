# Clearinghouse Integration Runbook

## Overview

Insurance eligibility verification, claim submission, and remittance
advice via Availity Essentials.

## Vendor Information

- **Vendor**: Availity
- **API Documentation**: https://developer.availity.com/
- **Support Contact**: https://www.availity.com/support
- **BAA Status**: Required — contact Availity for healthcare provider agreement

## Environment Variables

```bash
AVAILITY_API_KEY=***
AVAILITY_API_BASE_URL=https://api.availity.com/v1
```

## Account Setup

1. Sign up at https://www.availity.com/
2. Complete provider enrollment
3. Request API access through Availity Developer Portal
4. Complete BAA
5. Receive API credentials

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/availity/health
```

## Common Operations

### 1. Check Eligibility

```bash
curl -X POST https://api.concierge-os.example.com/integrations/availity/eligibility \
  -H "Authorization: Bearer ***" \
  -d '{
    "patient_id": "patient-123",
    "insurance_member_id": "MEMBER123",
    "insurance_group_number": "GROUP456",
    "npi": "1234567890",
    "service_type": "30"
  }'
```

### 2. Submit Claim

```bash
curl -X POST https://api.concierge-os.example.com/integrations/availity/claims \
  -H "Authorization: Bearer ***" \
  -d '{
    "patient_id": "patient-123",
    "claim_data": {
      "claimType": "professional",
      "patient": {"memberId": "MEMBER123"},
      "provider": {"npi": "1234567890"},
      "services": [{"code": "99213", "charge": 150.00}]
    }
  }'
```

### 3. Check Claim Status

```bash
curl https://api.concierge-os.example.com/integrations/availity/claims/CLAIM-ID \
  -H "Authorization: Bearer ***"
```

### 4. Get Remittance Advice

```bash
curl "https://api.concierge-os.example.com/integrations/availity/remittance?start_date=2026-06-01&limit=20" \
  -H "Authorization: Bearer ***"
```

## Troubleshooting

### Issue: Eligibility check fails

**Symptoms**: 400/500 errors on eligibility.

**Resolution**:
```bash
# Check payer support
grep "availity" /var/log/concierge-os/app.log | grep "payer"

# Verify member ID format
grep "availity" /var/log/concierge-os/app.log | grep "member"
```

### Issue: Claim rejected

**Symptoms**: Claim status shows "rejected".

**Resolution**:
```bash
# Check rejection reason
grep "availity" /var/log/concierge-os/app.log | grep "rejection"

# Verify NPI is enrolled with payer
curl https://api.concierge-os.example.com/integrations/availity/payers?search=PAYER-NAME
```

## Rollback

```bash
# Disable clearinghouse
curl -X POST https://api.concierge-os.example.com/admin/integrations/availity/maintenance \
  -d '{"enabled": false}'
```
