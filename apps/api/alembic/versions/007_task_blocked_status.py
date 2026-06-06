"""Add blocked task status.

Revision ID: 007_task_blocked_status
Revises: 006_patient_document_review_routing
Create Date: 2026-06-06
"""

from typing import Sequence, Union

from alembic import op

revision: str = "007_task_blocked_status"
down_revision: Union[str, None] = "006_patient_document_review_routing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'blocked'")


def downgrade() -> None:
    pass
