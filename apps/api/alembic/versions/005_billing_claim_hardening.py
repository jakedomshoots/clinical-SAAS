"""add billing claim hardening fields

Revision ID: 005
Revises: 004
Create Date: 2026-06-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('billing_cases', sa.Column('claim_control_number', sa.String(100), nullable=True))
    op.add_column('billing_cases', sa.Column('submission_ready_at', sa.DateTime(), nullable=True))
    op.add_column('billing_cases', sa.Column('submitted_at', sa.DateTime(), nullable=True))
    op.add_column('billing_cases', sa.Column('denied_at', sa.DateTime(), nullable=True))
    op.add_column('billing_cases', sa.Column('denial_reason', sa.Text(), nullable=True))
    op.add_column('billing_cases', sa.Column('denial_worked_at', sa.DateTime(), nullable=True))
    op.add_column('billing_cases', sa.Column('remittance_status', sa.String(50), nullable=False, server_default='not_received'))
    op.add_column('billing_cases', sa.Column('allowed_amount', sa.Float(), nullable=True))
    op.add_column('billing_cases', sa.Column('paid_amount', sa.Float(), nullable=True))
    op.add_column('billing_cases', sa.Column('paid_at', sa.DateTime(), nullable=True))
    op.create_index('ix_billing_cases_claim_control_number', 'billing_cases', ['claim_control_number'])
    op.create_index('ix_billing_cases_remittance_status', 'billing_cases', ['remittance_status'])


def downgrade() -> None:
    op.drop_index('ix_billing_cases_remittance_status', table_name='billing_cases')
    op.drop_index('ix_billing_cases_claim_control_number', table_name='billing_cases')
    op.drop_column('billing_cases', 'paid_at')
    op.drop_column('billing_cases', 'paid_amount')
    op.drop_column('billing_cases', 'allowed_amount')
    op.drop_column('billing_cases', 'remittance_status')
    op.drop_column('billing_cases', 'denial_worked_at')
    op.drop_column('billing_cases', 'denial_reason')
    op.drop_column('billing_cases', 'denied_at')
    op.drop_column('billing_cases', 'submitted_at')
    op.drop_column('billing_cases', 'submission_ready_at')
    op.drop_column('billing_cases', 'claim_control_number')
