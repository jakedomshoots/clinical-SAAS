"""add user access review fields

Revision ID: 003
Revises: 002
Create Date: 2026-06-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('access_reviewed_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('access_reviewed_by_id', sa.String(36), nullable=True))
    op.add_column('users', sa.Column('access_review_note', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'access_review_note')
    op.drop_column('users', 'access_reviewed_by_id')
    op.drop_column('users', 'access_reviewed_at')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'mfa_enabled')
