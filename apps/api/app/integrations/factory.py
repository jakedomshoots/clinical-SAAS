from collections.abc import Sequence

from app.config import settings
from app.integrations.base import ConfiguredIntegration
from app.integrations.calendar import CalendarClient
from app.integrations.clearinghouse import ClearinghouseClient
from app.integrations.communications import CommunicationsClient
from app.integrations.copilotkit import CopilotRuntimeClient
from app.integrations.ehr import EHRClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.portal import PortalClient
from app.integrations.sandbox import (
    SandboxCalendarClient,
    SandboxClearinghouseClient,
    SandboxCommunicationsClient,
    SandboxEHRClient,
    SandboxFaxProviderClient,
    SandboxPortalClient,
)


def integration_clients() -> Sequence[ConfiguredIntegration]:
    if settings.use_sandbox_adapters:
        return [
            SandboxEHRClient(settings.ehr_api_base_url),
            SandboxFaxProviderClient(settings.fax_provider_api_key),
            SandboxPortalClient(settings.portal_api_base_url),
            SandboxCalendarClient(settings.calendar_api_base_url),
            CopilotRuntimeClient(settings.copilotkit_runtime_url),
            SandboxCommunicationsClient(settings.communications_provider_api_key),
            SandboxClearinghouseClient(settings.clearinghouse_api_key),
        ]
    return [
        EHRClient(settings.ehr_api_base_url),
        FaxProviderClient(settings.fax_provider_api_key),
        PortalClient(settings.portal_api_base_url),
        CalendarClient(settings.calendar_api_base_url),
        CopilotRuntimeClient(settings.copilotkit_runtime_url),
        CommunicationsClient(settings.communications_provider_api_key),
        ClearinghouseClient(settings.clearinghouse_api_key),
    ]
