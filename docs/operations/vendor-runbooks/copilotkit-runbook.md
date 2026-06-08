# CopilotKit Runtime Runbook

## Overview

AI assistant runtime for clinical decision support and workflow automation.

## Vendor Information

- **Vendor**: CopilotKit
- **API Documentation**: https://docs.copilotkit.ai
- **Support Contact**: [To be configured]

## Environment Variables

```bash
COPILOTKIT_RUNTIME_URL=https://runtime.copilotkit.ai
COPILOTKIT_API_KEY=***
```

## Health Check

```bash
curl https://api.concierge-os.example.com/admin/integrations/copilotkit/health
```

## Common Operations

### 1. Test Assistant

```bash
curl -X POST https://api.concierge-os.example.com/integrations/copilotkit/assistants/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "What are the patient allergies?",
    "context": {"patient_id": "patient-123"}
  }'
```

## Safety Procedures

### Disable AI Assistant

In case of incorrect or unsafe recommendations:

```bash
curl -X POST https://api.concierge-os.example.com/admin/integrations/copilotkit/maintenance \
  -d '{"enabled": false, "reason": "Safety review required"}'
```

## Rollback

```bash
curl -X POST https://api.concierge-os.example.com/admin/integrations/copilotkit/maintenance \
  -d '{"enabled": false}'
```
