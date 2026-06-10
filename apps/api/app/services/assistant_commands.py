from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fax import Fax, FaxDirection
from app.models.patient import Patient
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


async def _first_patient_id(db: AsyncSession, user: User) -> str | None:
    return (
        await db.execute(
            select(Patient.id)
            .where(
                Patient.organization_id == user.organization_id,
                Patient.is_active.is_(True),
            )
            .order_by(Patient.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def _first_portal_reply_recipient_id(db: AsyncSession, user: User) -> str | None:
    return (
        await db.execute(
            select(User.id)
            .where(
                User.organization_id == user.organization_id,
                User.id != user.id,
                User.is_active.is_(True),
            )
            .order_by(User.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def _first_unmatched_inbound_fax_id(db: AsyncSession, user: User) -> str | None:
    return (
        await db.execute(
            select(Fax.id)
            .where(
                Fax.organization_id == user.organization_id,
                Fax.direction == FaxDirection.inbound,
                Fax.patient_id.is_(None),
            )
            .order_by(Fax.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def interpret_command(
    db: AsyncSession,
    user: User,
    request: AssistantCommandRequest,
) -> AssistantCommandResult:
    command = request.command.strip()
    normalized = command.lower()
    route_label = _route_label(request.route_path)
    patient_id = request.entity_id or _patient_id_from_path(request.route_path)

    if any(word in normalized for word in ("blocker", "blockers", "readiness", "launch")):
        review_focus = (
            "launch blockers"
            if "launch" in normalized or request.route_path.startswith(("/setup", "/operations"))
            else f"{route_label.lower()} blockers"
        )
        proposal = await assistant_proposals.create_proposal(
            db,
            AssistantProposalCreate(
                proposal_type="operations.review_blocker",
                title=f"Review {review_focus}",
                summary=command,
                route_path=request.route_path,
                entity_type=None,
                entity_id=None,
                payload={
                    "context": route_label,
                    "review_focus": review_focus,
                    "route_path": request.route_path,
                },
                confidence_reason=(
                    "The command requested blocker review without asking for an automatic write."
                ),
                source="concierge_command",
                input_mode=request.input_mode,
                original_command=command,
            ),
            user,
        )
        return AssistantCommandResult(
            result_type="proposal",
            message="Blocker review proposal staged for review.",
            proposal=proposal,
        )

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

    if any(
        phrase in normalized
        for phrase in ("portal reply", "draft reply", "message reply", "reply to patient")
    ):
        if not can_use_tool(user, "clinical.draft_portal_reply"):
            return AssistantCommandResult(
                result_type="blocked",
                message="Your role cannot stage portal reply draft proposals.",
            )
        recipient_id = await _first_portal_reply_recipient_id(db, user)
        if not recipient_id:
            return AssistantCommandResult(
                result_type="clarification",
                message="Add a message recipient before drafting a portal reply.",
            )
        proposal = await assistant_proposals.create_proposal(
            db,
            AssistantProposalCreate(
                proposal_type="clinical.draft_portal_reply",
                title="Draft portal reply",
                summary=command,
                route_path=request.route_path,
                entity_type=None,
                entity_id=None,
                payload={
                    "context": route_label,
                    "recipient_id": recipient_id,
                    "subject": "Care team follow-up",
                    "body": (
                        "Your care team reviewed your question about the lab result and will "
                        "follow up with the next step after provider review."
                    ),
                },
                confidence_reason=(
                    "The command requested a portal reply draft, which remains unsent until staff review."
                ),
                source="concierge_command",
                input_mode=request.input_mode,
                original_command=command,
            ),
            user,
        )
        return AssistantCommandResult(
            result_type="proposal",
            message="Portal reply draft proposal staged for review.",
            proposal=proposal,
        )

    if any(phrase in normalized for phrase in ("fax match", "match fax", "stage fax")):
        if not can_use_tool(user, "clinical.stage_fax_match"):
            return AssistantCommandResult(
                result_type="blocked",
                message="Your role cannot stage fax match proposals.",
            )
        fax_id = await _first_unmatched_inbound_fax_id(db, user)
        matched_patient_id = patient_id or await _first_patient_id(db, user)
        if not fax_id or not matched_patient_id:
            return AssistantCommandResult(
                result_type="clarification",
                message="An unmatched inbound fax and patient are required before staging a fax match.",
            )
        proposal = await assistant_proposals.create_proposal(
            db,
            AssistantProposalCreate(
                proposal_type="clinical.stage_fax_match",
                title="Stage fax match",
                summary=command,
                route_path="/faxes",
                entity_type="fax",
                entity_id=fax_id,
                payload={
                    "context": route_label,
                    "fax_id": fax_id,
                    "patient_id": matched_patient_id,
                },
                confidence_reason=(
                    "The command requested fax matching; ConciergeOS found an unmatched inbound fax and patient candidate."
                ),
                source="concierge_command",
                input_mode=request.input_mode,
                original_command=command,
            ),
            user,
        )
        return AssistantCommandResult(
            result_type="proposal",
            message="Fax match proposal staged for review.",
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
