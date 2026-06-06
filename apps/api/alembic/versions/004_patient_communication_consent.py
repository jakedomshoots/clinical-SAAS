"""add patient communication consent fields

Revision ID: 004
Revises: 003
Create Date: 2026-06-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('patients', sa.Column('sms_consent', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('patients', sa.Column('email_consent', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('patients', sa.Column('preferred_contact_channel', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('patients', 'preferred_contact_channel')
    op.drop_column('patients', 'email_consent')
    op.drop_column('patients', 'sms_consent')
