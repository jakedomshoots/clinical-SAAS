"""Add security hardening session fields.

Revision ID: 009_security_hardening
Revises: 008_user_password_rotation
Create Date: 2026-06-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_security_hardening"
down_revision: Union[str, None] = "008_user_password_rotation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("session_version", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(), nullable=True))
    op.alter_column("users", "session_version", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "session_version")
