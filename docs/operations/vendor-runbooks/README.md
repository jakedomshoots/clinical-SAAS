# Vendor Integration Runbooks

This directory contains operational runbooks for each vendor integration.

## Runbook Index

| Vendor         | Runbook                                                | Status |
| -------------- | ------------------------------------------------------ | ------ |
| EHR            | [ehr-runbook.md](ehr-runbook.md)                       | Draft  |
| Fax            | [fax-runbook.md](fax-runbook.md)                       | Draft  |
| Portal         | [portal-runbook.md](portal-runbook.md)                 | Draft  |
| Calendar       | [calendar-runbook.md](calendar-runbook.md)             | Draft  |
| Communications | [communications-runbook.md](communications-runbook.md) | Draft  |
| Clearinghouse  | [clearinghouse-runbook.md](clearinghouse-runbook.md)   | Draft  |
| Labs/HIE       | [labs-hie-runbook.md](labs-hie-runbook.md)             | Draft  |
| Payments       | [payments-runbook.md](payments-runbook.md)             | Draft  |
| eRx            | [erx-runbook.md](erx-runbook.md)                       | Draft  |
| Identity/MFA   | [identity-runbook.md](identity-runbook.md)             | Draft  |
| CopilotKit     | [copilotkit-runbook.md](copilotkit-runbook.md)         | Draft  |

## Common Procedures

### Health Check

```bash
curl https://api.concierge-os.example.com/health
```

### Integration Status

```bash
curl https://api.concierge-os.example.com/admin/integrations/health
```

### View Recent Logs

```bash
aws logs tail /ecs/concierge-os-production --follow
```

### Emergency Contacts

- On-call engineer: See PagerDuty
- Clinic manager: See staff directory
- AWS support: Business support plan
