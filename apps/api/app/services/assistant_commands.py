from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.assistant import (
    AssistantCommandRequest,
    AssistantCommandResult,
    AssistantProposalCreate,
)
from app.services import assistant_proposals
from app.services.assistant_policy import can_use_tool


def _route_label(path: str) -> str:
    if path.startswith("/patients/"):
        return "Patient chart"
    if path.startswith("/patients"):
        return "Patient search"
    if path.startswith("/tasks"):
        return "Task queue"
    if path.startswith("/scheduling"):
        return "Schedule"
    if path.startswith("/faxes"):
        return "Fax center"
    if path.startswith("/messaging"):
        return "Messages"
    if path.startswith("/billing"):
        return "Billing"
    if path.startswith("/operations"):
        return "Operations"
    if path.startswith("/setup"):
        return "Setup checklist"
    return "Command Center"


def _patient_id_from_path(path: str) -> str | None:
    if not path.startswith("/patients/"):
        return None
    parts = path.split("/")
    return parts[2] if len(parts) > 2 and parts[2] else None


def _navigation_target(command: str) -> tuple[str, str] | None:
    targets = [
        (("billing", "claim", "checkout"), "/billing", "Open billing"),
        (("fax", "faxes"), "/faxes", "Open fax center"),
        (("message", "messages", "portal"), "/messaging", "Open messages"),
        (("task", "tasks", "queue"), "/tasks", "Open task queue"),
        (("schedule", "calendar"), "/scheduling", "Open schedule"),
        (("patient", "patients", "chart"), "/patients", "Open patients"),
        (("operation", "operations", "readiness"), "/operations", "Open operations"),
    ]
    if not any(word in command for word in ("open", "go to", "show", "navigate")):
        return None
    for keywords, route, title in targets:
        if any(keyword in command for keyword in keywords):
            return route, title
    return None


async def interpret_command(
    db: AsyncSession,
    user: User,
    request: AssistantCommandRequest,
) -> AssistantCommandResult:
    command = request.command.strip()
    normalized = command.lower()
    route_label = _route_label(request.route_path)
    patient_id = request.entity_id or _patient_id_from_path(request.route_path)

    if any(word in normalized for word in ("summarize", "summary", "what am i looking at")):
        return AssistantCommandResult(
            result_type="answer",
            message=(
                f"{route_label}: current view context is available for safe read-only guidance."
            ),
        )

    navigation = _navigation_target(normalized)
    if navigation:
        route_path, title = navigation
        proposal = await assistant_proposals.create_proposal(
            db,
            AssistantProposalCreate(
                proposal_type="navigation.open_route",
                title=title,
                summary=f"Navigate to {route_path}.",
                route_path=route_path,
                entity_type=None,
                entity_id=None,
                payload={"route_path": route_path},
                confidence_reason="The command requested navigation to a known ConciergeOS area.",
                source="concierge_command",
                input_mode=request.input_mode,
                original_command=command,
            ),
            user,
        )
        return AssistantCommandResult(
            result_type="proposal",
            message="Navigation proposal staged for review.",
            proposal=proposal,
        )

    if any(word in normalized for word in ("follow up", "follow-up", "task", "todo", "to do")):
        if not can_use_tool(user, "clinical.create_follow_up_task"):
            return AssistantCommandResult(
                result_type="blocked",
                message="Your role cannot stage clinical follow-up task proposals.",
            )
        if not patient_id:
            return AssistantCommandResult(
                result_type="clarification",
                message="Open a patient chart or name a patient before creating a follow-up task.",
            )
        proposal = await assistant_proposals.create_proposal(
            db,
            AssistantProposalCreate(
                proposal_type="clinical.create_follow_up_task",
                title="Create follow-up task",
                summary=command,
                route_path=request.route_path,
                entity_type="patient",
                entity_id=patient_id,
                payload={
                    "context": route_label,
                    "patient_id": patient_id,
                    "title": command[:160],
                    "priority": "high",
                },
                confidence_reason=(
                    "The command requested a follow-up task while patient context was available."
                ),
                source="concierge_command",
                input_mode=request.input_mode,
                original_command=command,
            ),
            user,
        )
        return AssistantCommandResult(
            result_type="proposal",
            message="Follow-up task proposal staged for review.",
            proposal=proposal,
        )

    return AssistantCommandResult(
        result_type="clarification",
        message=(
            "Try asking to open a workspace, create a follow-up task from a patient chart, "
            "or summarize the current view."
        ),
    )
