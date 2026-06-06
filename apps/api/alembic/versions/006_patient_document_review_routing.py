"""add patient document review routing fields

Revision ID: 006
Revises: 005
Create Date: 2026-06-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('patient_documents', sa.Column('source_contact', sa.String(160), nullable=True))
    op.add_column('patient_documents', sa.Column('source_phone', sa.String(50), nullable=True))
    op.add_column('patient_documents', sa.Column('source_fax', sa.String(50), nullable=True))
    op.add_column('patient_documents', sa.Column('source_reference', sa.String(160), nullable=True))
    op.add_column('patient_documents', sa.Column('requested_by', sa.String(120), nullable=True))
    op.add_column('patient_documents', sa.Column('routed_to_role', sa.String(80), nullable=True))
    op.add_column('patient_documents', sa.Column('review_priority', sa.String(50), nullable=False, server_default='normal'))
    op.add_column('patient_documents', sa.Column('review_note', sa.Text(), nullable=True))
    op.add_column('patient_documents', sa.Column('reviewed_by', sa.String(120), nullable=True))
    op.add_column('patient_documents', sa.Column('reviewed_at', sa.DateTime(), nullable=True))
    op.create_index('ix_patient_documents_routed_to_role', 'patient_documents', ['routed_to_role'])
    op.create_index('ix_patient_documents_review_priority', 'patient_documents', ['review_priority'])


def downgrade() -> None:
    op.drop_index('ix_patient_documents_review_priority', table_name='patient_documents')
    op.drop_index('ix_patient_documents_routed_to_role', table_name='patient_documents')
    op.drop_column('patient_documents', 'reviewed_at')
    op.drop_column('patient_documents', 'reviewed_by')
    op.drop_column('patient_documents', 'review_note')
    op.drop_column('patient_documents', 'review_priority')
    op.drop_column('patient_documents', 'routed_to_role')
    op.drop_column('patient_documents', 'requested_by')
    op.drop_column('patient_documents', 'source_reference')
    op.drop_column('patient_documents', 'source_fax')
    op.drop_column('patient_documents', 'source_phone')
    op.drop_column('patient_documents', 'source_contact')
