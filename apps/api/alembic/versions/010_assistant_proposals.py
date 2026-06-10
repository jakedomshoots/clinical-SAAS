"""Add assistant proposals.

Revision ID: 010_assistant_proposals
Revises: 009_security_hardening
Create Date: 2026-06-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_assistant_proposals"
down_revision: Union[str, None] = "009_security_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assistant_proposals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("organization_id", sa.String(length=36), nullable=False),
        sa.Column("proposal_type", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("route_path", sa.String(length=300), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=True),
        sa.Column("entity_id", sa.String(length=80), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("confidence_reason", sa.String(length=500), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("input_mode", sa.String(length=20), nullable=True),
        sa.Column("original_command", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=False),
        sa.Column("resolved_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assistant_proposals_entity_id", "assistant_proposals", ["entity_id"])
    op.create_index("ix_assistant_proposals_entity_type", "assistant_proposals", ["entity_type"])
    op.create_index("ix_assistant_proposals_expires_at", "assistant_proposals", ["expires_at"])
    op.create_index(
        "ix_assistant_proposals_organization_id",
        "assistant_proposals",
        ["organization_id"],
    )
    op.create_index(
        "ix_assistant_proposals_proposal_type",
        "assistant_proposals",
        ["proposal_type"],
    )
    op.create_index("ix_assistant_proposals_route_path", "assistant_proposals", ["route_path"])
    op.create_index("ix_assistant_proposals_status", "assistant_proposals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_assistant_proposals_status", table_name="assistant_proposals")
    op.drop_index("ix_assistant_proposals_route_path", table_name="assistant_proposals")
    op.drop_index("ix_assistant_proposals_proposal_type", table_name="assistant_proposals")
    op.drop_index("ix_assistant_proposals_organization_id", table_name="assistant_proposals")
    op.drop_index("ix_assistant_proposals_expires_at", table_name="assistant_proposals")
    op.drop_index("ix_assistant_proposals_entity_type", table_name="assistant_proposals")
    op.drop_index("ix_assistant_proposals_entity_id", table_name="assistant_proposals")
    op.drop_table("assistant_proposals")
