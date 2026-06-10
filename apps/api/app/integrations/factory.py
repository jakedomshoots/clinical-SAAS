from collections.abc import Sequence

from app.config import settings
from app.integrations.auth0 import Auth0Client
from app.integrations.availity import AvailityClient
from app.integrations.base import ConfiguredIntegration
from app.integrations.copilotkit import CopilotRuntimeClient
from app.integrations.dosespot import DoseSpotClient
from app.integrations.ehr import EHRClient
from app.integrations.google_calendar import GoogleCalendarClient
from app.integrations.intuit_payments import IntuitPaymentsClient
from app.integrations.labcorp import LabCorpClient
from app.integrations.labs_hie import LabsHIEClient
from app.integrations.portal import PortalClient
from app.integrations.quest import QuestClient
from app.integrations.sandbox import (
    SandboxCalendarClient,
    SandboxClearinghouseClient,
    SandboxCommunicationsClient,
    SandboxEHRClient,
    SandboxERxClient,
    SandboxFaxProviderClient,
    SandboxIdentityClient,
    SandboxLabsHIEClient,
    SandboxPaymentsClient,
    SandboxPortalClient,
)
from app.integrations.srfax import SRFaxClient
from app.integrations.twilio import TwilioClient


class IntegrationFactory:
    """Factory for creating integration clients."""

    def __init__(self) -> None:
        self._clients: dict[str, ConfiguredIntegration] = {}
        self._refresh_clients()

    def _refresh_clients(self) -> None:
        """Refresh the client registry from current settings."""
        self._clients = {}
        for client in integration_clients():
            self._clients[client.name] = client

    def get_client(self, name: str) -> ConfiguredIntegration | None:
        """Get an integration client by name."""
        return self._clients.get(name)

    def list_clients(self) -> list[str]:
        """List all available integration names."""
        return list(self._clients.keys())

    def get_all_clients(self) -> Sequence[ConfiguredIntegration]:
        """Get all integration clients."""
        return list(self._clients.values())

    def refresh(self) -> None:
        """Refresh all clients from current settings."""
        self._refresh_clients()


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
            SandboxLabsHIEClient(settings.labs_hie_api_base_url),
            SandboxPaymentsClient(settings.payments_api_key),
            SandboxERxClient(settings.erx_api_base_url),
            SandboxIdentityClient(settings.identity_provider_issuer_url),
        ]
    return [
        EHRClient(settings.ehr_api_base_url),
        SRFaxClient(settings.srfax_api_key),
        PortalClient(settings.portal_api_base_url),
        GoogleCalendarClient(settings.google_calendar_api_key),
        CopilotRuntimeClient(settings.copilotkit_runtime_url),
        TwilioClient(settings.twilio_api_key),
        AvailityClient(settings.availity_api_key),
        LabsHIEClient(settings.labs_hie_api_base_url),
        IntuitPaymentsClient(settings.intuit_payments_api_key),
        LabCorpClient(settings.labcorp_api_key),
        QuestClient(settings.quest_api_key),
        DoseSpotClient(settings.dosespot_api_key),
        Auth0Client(settings.auth0_api_key),
    ]
