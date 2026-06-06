"""Add user password rotation fields.

Revision ID: 008_user_password_rotation
Revises: 007_task_blocked_status
Create Date: 2026-06-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_user_password_rotation"
down_revision: Union[str, None] = "007_task_blocked_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_must_change", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("users", sa.Column("temporary_password_expires_at", sa.DateTime(), nullable=True))
    op.alter_column("users", "password_must_change", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "temporary_password_expires_at")
    op.drop_column("users", "password_must_change")
