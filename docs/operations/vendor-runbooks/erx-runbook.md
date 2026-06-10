# eRx Integration Runbook

## Overview

Electronic prescribing, medication history, and pharmacy lookup
via DoseSpot.

## Vendor Information

- **Vendor**: DoseSpot
- **API Documentation**: https://www.dosespot.com/api-documentation/
- **Support Contact**: DoseSpot Provider Support
- **DEA Requirements**: Provider must have valid DEA registration

## Environment Variables

```bash
DOSESPOT_API_KEY=***
DOSESPOT_API_BASE_URL=https://my.dosespot.com/webapi
```

## Account Setup

1. Contact DoseSpot sales for provider enrollment
2. Complete DEA verification
3. Receive API credentials
4. Configure pharmacy defaults
5. Train providers on e-prescribing workflow

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/dosespot/health
```

## Common Operations

### 1. Send Prescription

```bash
curl -X POST https://api.concierge-os.example.com/integrations/dosespot/prescriptions \
  -H "Authorization: Bearer ***" \
  -d '{
    "patient_id": "patient-123",
    "provider_id": "prov-001",
    "medication_name": "Lisinopril",
    "strength": "10mg",
    "quantity": "30 tablets",
    "directions": "Take 1 tablet by mouth daily",
    "pharmacy_id": "pharm-456",
    "refills": 2,
    "substitution_allowed": true
  }'
```

### 2. Get Medication History

```bash
curl "https://api.concierge-os.example.com/integrations/dosespot/medicationhistory?patient_id=patient-123" \
  -H "Authorization: Bearer ***"
```

### 3. Search Pharmacies

```bash
curl "https://api.concierge-os.example.com/integrations/dosespot/pharmacies?zip=12345&radius=10" \
  -H "Authorization: Bearer ***"
```

### 4. Cancel Prescription

```bash
curl -X POST https://api.concierge-os.example.com/integrations/dosespot/prescriptions/RX-ID/cancel \
  -H "Authorization: Bearer ***" \
  -d '{"reason": "Patient request"}'
```

## Troubleshooting

### Issue: Prescription not sending

**Symptoms**: eRx status shows error.

**Resolution**:

```bash
# Check DEA registration status
grep "dosespot" /var/log/concierge-os/app.log | grep "DEA"

# Verify pharmacy is in network
grep "dosespot" /var/log/concierge-os/app.log | grep "pharmacy"
```

### Issue: Medication history empty

**Symptoms**: No history returned for patient.

**Resolution**:

```bash
# Check patient consent for medication history
grep "dosespot" /var/log/concierge-os/app.log | grep "consent"

# Verify Surescripts connectivity
grep "dosespot" /var/log/concierge-os/app.log | grep "surescripts"
```

## Rollback

```bash
# Disable eRx (fallback to paper/pharmacy call)
curl -X POST https://api.concierge-os.example.com/admin/integrations/dosespot/maintenance \
  -d '{"enabled": false}'
```
