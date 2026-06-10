# Labs Integration Runbook

## Overview

Lab order submission and result retrieval via LabCorp Link API and Quest Care360 API.

## Vendor Information

### LabCorp

- **Vendor**: LabCorp
- **API Documentation**: https://www.labcorp.com/healthcare-providers/technology-integration
- **Support Contact**: LabCorp Provider Services
- **BAA Status**: [Pending]

### Quest Diagnostics

- **Vendor**: Quest Diagnostics
- **API Documentation**: https://developer.questdiagnostics.com/
- **Support Contact**: Quest Provider Services
- **BAA Status**: [Pending]

## Environment Variables

```bash
LABCORP_API_KEY=***
LABCORP_API_BASE_URL=https://api.labcorp.com/v2
QUEST_API_KEY=***
QUEST_API_BASE_URL=https://api.questdiagnostics.com/v1
```

## Account Setup

### LabCorp

1. Contact LabCorp sales to enable API access
2. Complete BAA and technical onboarding
3. Receive API credentials and test environment access
4. Validate connectivity with test orders

### Quest

1. Sign up at https://developer.questdiagnostics.com/
2. Request Care360 API access
3. Complete BAA
4. Receive API credentials

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/labcorp/health
curl https://api.concierge-os.example.com/admin/integrations/quest/health
```

## Common Operations

### 1. Submit Lab Order (LabCorp)

```bash
curl -X POST https://api.concierge-os.example.com/integrations/labcorp/orders \
  -H "Authorization: Bearer ***" \
  -d '{
    "patient_id": "patient-123",
    "test_codes": ["CBC", "CMP"],
    "provider_id": "prov-001",
    "urgency": "routine",
    "diagnosis_codes": ["Z00.00"]
  }'
```

### 2. Submit Lab Order (Quest)

```bash
curl -X POST https://api.concierge-os.example.com/integrations/quest/orders \
  -H "Authorization: Bearer ***" \
  -d '{
    "patient_id": "patient-123",
    "test_codes": ["CBC", "CMP"],
    "provider_id": "prov-001",
    "urgency": "routine",
    "diagnosis_codes": ["Z00.00"]
  }'
```

### 3. Check Results

```bash
curl "https://api.concierge-os.example.com/integrations/labcorp/results?patient_id=patient-123" \
  -H "Authorization: Bearer ***"

curl "https://api.concierge-os.example.com/integrations/quest/results?patient_id=patient-123" \
  -H "Authorization: Bearer ***"
```

## Troubleshooting

### Issue: Results not appearing

**Symptoms**: Lab results not importing into patient chart.

**Resolution**:

```bash
# Check result webhook delivery
grep "labcorp\|quest" /var/log/concierge-os/app.log | grep "webhook"

# Verify patient matching
grep "patient match" /var/log/concierge-os/app.log | tail -20

# Check order status
curl https://api.concierge-os.example.com/integrations/labcorp/orders/ORDER-ID/status
```

### Issue: Order submission fails

**Symptoms**: Lab orders not accepted.

**Resolution**:

```bash
# Check test code validity
grep "labcorp\|quest" /var/log/concierge-os/app.log | grep "invalid test"

# Verify provider is enrolled
curl https://api.concierge-os.example.com/integrations/labcorp/providers/prov-001/status
```

## Rollback

```bash
# Disable lab integrations
curl -X POST https://api.concierge-os.example.com/admin/integrations/labcorp/maintenance \
  -d '{"enabled": false}'

curl -X POST https://api.concierge-os.example.com/admin/integrations/quest/maintenance \
  -d '{"enabled": false}'
```
