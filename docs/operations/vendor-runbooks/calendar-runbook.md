# Calendar Integration Runbook

## Overview

Appointment scheduling and provider availability via Google Calendar.

## Vendor Information

- **Vendor**: Google
- **API Documentation**: https://developers.google.com/calendar/api/v3/reference
- **Support Contact**: https://support.google.com/a
- **HIPAA Compliance**: Google Workspace with BAA

## Environment Variables

```bash
GOOGLE_CALENDAR_API_KEY=***
```

## Account Setup

1. Create Google Cloud project
2. Enable Calendar API
3. Create OAuth 2.0 credentials
4. Configure consent screen
5. Get refresh token for service account
6. Share provider calendars with service account

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/google_calendar/health
```

## Common Operations

### 1. Create Appointment

```bash
curl -X POST https://api.concierge-os.example.com/integrations/google_calendar/events \
  -H "Authorization: Bearer ***" \
  -d '{
    "calendar_id": "provider@clinic.com",
    "summary": "Patient: Jane Doe",
    "start_time": "2026-06-15T10:00:00-04:00",
    "end_time": "2026-06-15T10:30:00-04:00",
    "description": "Annual physical",
    "location": "Main Office"
  }'
```

### 2. Check Availability

```bash
curl -X POST https://api.concierge-os.example.com/integrations/google_calendar/freebusy \
  -H "Authorization: Bearer ***" \
  -d '{
    "calendar_ids": ["provider1@clinic.com", "provider2@clinic.com"],
    "start_time": "2026-06-15T09:00:00-04:00",
    "end_time": "2026-06-15T17:00:00-04:00"
  }'
```

### 3. Cancel Appointment

```bash
curl -X DELETE https://api.concierge-os.example.com/integrations/google_calendar/events/EVENT-ID \
  -H "Authorization: Bearer ***" \
  -d '{"calendar_id": "provider@clinic.com"}'
```

## Troubleshooting

### Issue: Calendar not syncing

**Symptoms**: Appointments not appearing in Google Calendar.

**Resolution**:

```bash
# Check API quota
grep "google_calendar" /var/log/concierge-os/app.log | grep "quota"

# Verify calendar is shared with service account
grep "google_calendar" /var/log/concierge-os/app.log | grep "permission"
```

### Issue: Auth errors

**Symptoms**: 401 errors from Google API.

**Resolution**:

```bash
# Token may be expired — refresh
grep "google_calendar" /var/log/concierge-os/app.log | grep "token"

# Re-authorize service account
```

## Rollback

```bash
# Disable calendar sync (fallback to manual scheduling)
curl -X POST https://api.concierge-os.example.com/admin/integrations/google_calendar/maintenance \
  -d '{"enabled": false}'
```
