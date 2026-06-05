from app.models.user import User, UserRole

CREATE_FOLLOW_UP_TASK = "clinical.create_follow_up_task"
DRAFT_PORTAL_REPLY = "clinical.draft_portal_reply"
STAGE_FAX_MATCH = "clinical.stage_fax_match"

ASSISTANT_TOOL_POLICY: dict[str, set[UserRole]] = {
    CREATE_FOLLOW_UP_TASK: {
        UserRole.admin,
        UserRole.provider,
        UserRole.ma,
        UserRole.manager,
    },
    DRAFT_PORTAL_REPLY: {
        UserRole.admin,
        UserRole.provider,
        UserRole.ma,
        UserRole.manager,
    },
    STAGE_FAX_MATCH: {
        UserRole.admin,
        UserRole.front_desk,
        UserRole.ma,
        UserRole.manager,
    },
}


def allowed_tools_for(user: User) -> list[str]:
    return sorted(
        tool_id for tool_id, roles in ASSISTANT_TOOL_POLICY.items() if user.role in roles
    )


def can_use_tool(user: User, tool_id: str) -> bool:
    return tool_id in allowed_tools_for(user)
