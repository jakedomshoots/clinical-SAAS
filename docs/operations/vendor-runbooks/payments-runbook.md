# Payments Integration Runbook

## Overview

Patient payment processing, refunds, and reconciliation via Intuit QuickBooks Payments.

## Vendor Information

- **Vendor**: Intuit QuickBooks Payments
- **API Documentation**: https://developer.intuit.com/app/developer/qbpayments/docs
- **Support Contact**: https://developer.intuit.com/help
- **PCI Compliance**: Intuit handles PCI compliance

## Environment Variables

```bash
INTUIT_PAYMENTS_API_KEY=***
INTUIT_PAYMENTS_BASE_URL=https://sandbox.api.intuit.com  # Use https://api.intuit.com for production
```

## Account Setup

1. Sign up at https://developer.intuit.com/
2. Create a QuickBooks Payments app
3. Get OAuth 2.0 credentials (Client ID + Secret)
4. Generate access token for API calls
5. Request production access when ready

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/intuit_payments/health
```

## Common Operations

### 1. Process Payment

```bash
curl -X POST https://api.concierge-os.example.com/integrations/intuit_payments/charges \
  -H "Authorization: Bearer ***" \
  -d '{
    "patient_id": "patient-123",
    "amount_cents": 2500,
    "method": "card",
    "card_token": "intuit-card-token-xxx",
    "description": "Office visit copay"
  }'
```

### 2. Process Refund

```bash
curl -X POST https://api.concierge-os.example.com/integrations/intuit_payments/refunds \
  -H "Authorization: Bearer ***" \
  -d '{
    "transaction_id": "txn-456",
    "amount_cents": 2500,
    "reason": "Overpayment"
  }'
```

### 3. Get Transaction

```bash
curl https://api.concierge-os.example.com/integrations/intuit_payments/charges/txn-456 \
  -H "Authorization: Bearer ***"
```

## Troubleshooting

### Issue: Payment declined

**Symptoms**: Patient payment not processing.

**Resolution**:

```bash
# Check payment method validity
grep "intuit" /var/log/concierge-os/app.log | grep "declined"

# Verify token is valid
curl -H "Authorization: Bearer ***" \
  "https://sandbox.api.intuit.com/quickbooks/v4/payments/tokens/validate"
```

### Issue: Authentication errors

**Symptoms**: 401 errors from Intuit API.

**Resolution**:

```bash
# Token may be expired — refresh OAuth token
curl -X POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer \
  -H "Authorization: Basic ***" \
  -d "grant_type=refresh_token&refresh_token=***"
```

## Rollback

```bash
# Disable Intuit payments (fallback to cash/check)
curl -X POST https://api.concierge-os.example.com/admin/integrations/intuit_payments/maintenance \
  -d '{"enabled": false}'
```
