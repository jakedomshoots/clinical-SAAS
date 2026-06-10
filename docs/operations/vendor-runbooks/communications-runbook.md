# Communications Integration Runbook

## Overview

Patient SMS, voice calls, and two-way messaging via Twilio.
Replaces DrChrono's built-in messaging functionality.

## Vendor Information

- **Vendor**: Twilio
- **API Documentation**: https://www.twilio.com/docs/messaging/api
- **Support Contact**: https://support.twilio.com
- **BAA Status**: Twilio offers a BAA for HIPAA-eligible services

## Environment Variables

```bash
TWILIO_API_KEY=***
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+155****4567
```

## Account Setup

1. Sign up at https://www.twilio.com/try-twilio
2. Verify your business identity
3. Buy a phone number (or port existing)
4. Request HIPAA BAA if needed
5. Configure webhook URL for incoming messages

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/twilio/health
```

## Common Operations

### 1. Send SMS

```bash
curl -X POST https://api.concierge-os.example.com/integrations/twilio/messages \
  -H "Authorization: Bearer *** \
  -d '{
    "to": "+155****4567",
    "body": "Your appointment is confirmed for tomorrow at 10am.",
    "patient_id": "patient-123"
  }'
```

### 2. Send Appointment Reminder

```bash
curl -X POST https://api.concierge-os.example.com/integrations/twilio/reminders \
  -H "Authorization: Bearer *** \
  -d '{
    "to": "+155****4567",
    "patient_name": "Jane Doe",
    "appointment_time": "2026-06-15 10:00 AM",
    "provider_name": "Dr. Smith",
    "location": "Main Office"
  }'
```

### 3. Make Voice Call

```bash
curl -X POST https://api.concierge-os.example.com/integrations/twilio/calls \
  -H "Authorization: Bearer *** \
  -d '{
    "to": "+155****4567",
    "twiml": "<Response><Say>Hello, this is a reminder from the clinic.</Say></Response>",
    "patient_id": "patient-123"
  }'
```

### 4. Get Message History

````bash
curl "https://api.concierge-os.example.com/integrations/twilio/messages?to=+155****4567&limit=20" \
  -H "Authorization: Bearer *** Troubleshooting

### Issue: Messages not sending

**Symptoms**: SMS not delivered to patients.

**Resolution**:
```bash
# Check Twilio status
grep "twilio" /var/log/concierge-os/app.log | grep "error"

# Verify phone number is valid
curl https://api.concierge-os.example.com/integrations/twilio/lookup/+155****4567

# Check account balance
curl -u "ACxxx:*** \
  "https://api.twilio.com/2010-04-01/Accounts/ACxxx/Balance.json"
````

### Issue: Incoming messages not received

**Symptoms**: Patient replies not showing in system.

**Resolution**:

```bash
# Verify webhook URL is configured
grep "webhook" /var/log/concierge-os/app.log | grep "twilio"

# Check webhook signature validation
grep "twilio" /var/log/concierge-os/app.log | grep "signature"
```

## Rollback

```bash
# Disable Twilio messaging
curl -X POST https://api.concierge-os.example.com/admin/integrations/twilio/maintenance \
  -d '{"enabled": false}'
```
