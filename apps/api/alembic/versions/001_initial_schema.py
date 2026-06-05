"""initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('role', sa.Enum('admin', 'provider', 'ma', 'front_desk', 'manager', name='userrole'), nullable=False),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default'),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'patients',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default', index=True),
        sa.Column('mrn', sa.String(20), nullable=False, unique=True, index=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('dob', sa.Date(), nullable=False),
        sa.Column('gender', sa.String(50), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('address', sa.JSON(), nullable=True),
        sa.Column('emergency_contact', sa.JSON(), nullable=True),
        sa.Column('insurance', sa.JSON(), nullable=True),
        sa.Column('allergies', sa.JSON(), server_default=sa.text("'[]'")),
        sa.Column('problem_list', sa.JSON(), server_default=sa.text("'[]'")),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'audit_log',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'organization_id',
            sa.String(36),
            nullable=False,
            server_default='default',
            index=True,
        ),
        sa.Column('actor_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_type', sa.String(100), nullable=False, index=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.String(36), nullable=False, index=True),
        sa.Column('payload', sa.JSON(), server_default=sa.text("'{}'")),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), index=True),
    )

    op.create_table(
        'tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'organization_id',
            sa.String(36),
            nullable=False,
            server_default='default',
            index=True,
        ),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.String(2000), nullable=True),
        sa.Column('priority', sa.Enum('low', 'normal', 'high', 'urgent', name='taskpriority'), nullable=False, server_default='normal'),
        sa.Column('status', sa.Enum('open', 'in_progress', 'completed', 'cancelled', name='taskstatus'), nullable=False, server_default='open'),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('assigned_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_type', sa.String(100), nullable=True, index=True),
        sa.Column('source_id', sa.String(36), nullable=True, index=True),
        sa.Column('delivery_channel', sa.String(30), nullable=True, index=True),
        sa.Column('delivery_status', sa.String(30), nullable=True, index=True),
        sa.Column('delivery_recipient', sa.String(255), nullable=True),
        sa.Column('delivery_provider_message_id', sa.String(255), nullable=True),
        sa.Column('delivery_error', sa.String(500), nullable=True),
        sa.Column('delivery_attempts', sa.Integer(), server_default='0'),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('delivery_payload', sa.JSON(), nullable=True),
        sa.Column('creator_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'appointments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'organization_id',
            sa.String(36),
            nullable=False,
            server_default='default',
            index=True,
        ),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=False, index=True),
        sa.Column('end_time', sa.DateTime(), nullable=False),
        sa.Column('type', sa.String(50), server_default='office_visit'),
        sa.Column('status', sa.Enum('scheduled', 'checked_in', 'roomed', 'provider_review', 'checkout', 'in_progress', 'completed', 'cancelled', 'no_show', name='appointmentstatus'), nullable=False, server_default='scheduled'),
        sa.Column('notes', sa.String(2000), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'provider_availability',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'organization_id',
            sa.String(36),
            nullable=False,
            server_default='default',
            index=True,
        ),
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.String(5), nullable=False),
        sa.Column('end_time', sa.String(5), nullable=False),
    )

    op.create_table(
        'faxes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'organization_id',
            sa.String(36),
            nullable=False,
            server_default='default',
            index=True,
        ),
        sa.Column('direction', sa.Enum('inbound', 'outbound', name='faxdirection'), nullable=False),
        sa.Column('status', sa.Enum('pending', 'sending', 'sent', 'received', 'processing', 'failed', name='faxstatus'), server_default='pending'),
        sa.Column('from_number', sa.String(20), nullable=False),
        sa.Column('to_number', sa.String(20), nullable=False),
        sa.Column('pages', sa.Integer(), server_default='1'),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True),
        sa.Column('matched_by', sa.String(100), nullable=True),
        sa.Column('ocr_text', sa.String(10000), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'patient_documents',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default', index=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('source', sa.String(200), nullable=False),
        sa.Column('document_type', sa.String(100), nullable=False),
        sa.Column(
            'status',
            sa.Enum('received', 'needs_review', 'filed', 'reconciled', 'rejected', name='patientdocumentstatus'),
            nullable=False,
            server_default='received',
            index=True,
        ),
        sa.Column('matched_by', sa.String(100), nullable=True),
        sa.Column('pages', sa.Integer(), server_default='1'),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('received_at', sa.DateTime(), server_default=sa.text('now()'), index=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'patient_medications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default', index=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('dose', sa.String(100), nullable=True),
        sa.Column('directions', sa.String(300), nullable=True),
        sa.Column('source', sa.String(200), nullable=True),
        sa.Column('status', sa.Enum('active', 'review', 'held', 'discontinued', name='medicationstatus'), nullable=False, server_default='active', index=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'patient_care_plan_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default', index=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('assigned_to_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('owner_role', sa.String(100), nullable=False),
        sa.Column('item', sa.String(500), nullable=False),
        sa.Column('due', sa.String(100), nullable=True),
        sa.Column('status', sa.Enum('open', 'in_progress', 'completed', 'blocked', name='careplanstatus'), nullable=False, server_default='open', index=True),
        sa.Column('escalation', sa.String(100), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'patient_lab_results',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default', index=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('collected_at', sa.DateTime(), nullable=True, index=True),
        sa.Column('panel', sa.String(120), nullable=False),
        sa.Column('result', sa.String(300), nullable=False),
        sa.Column('flag', sa.String(50), nullable=True),
        sa.Column('status', sa.Enum('new', 'needs_review', 'reviewed', 'filed', name='labresultstatus'), nullable=False, server_default='new', index=True),
        sa.Column('source', sa.String(200), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'patient_encounters',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default', index=True),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('appointment_id', sa.String(36), sa.ForeignKey('appointments.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('provider_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('encounter_type', sa.String(100), nullable=False),
        sa.Column('status', sa.Enum('draft', 'provider_review', 'signed', 'amended', name='encounterstatus'), nullable=False, server_default='draft', index=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('subjective', sa.Text(), nullable=True),
        sa.Column('objective', sa.Text(), nullable=True),
        sa.Column('assessment', sa.Text(), nullable=True),
        sa.Column('plan', sa.Text(), nullable=True),
        sa.Column('signed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column(
            'organization_id',
            sa.String(36),
            nullable=False,
            server_default='default',
            index=True,
        ),
        sa.Column('sender_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recipient_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject', sa.String(200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('thread_id', sa.String(36), nullable=True, index=True),
        sa.Column('is_read', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), index=True),
    )

    op.create_table(
        'integration_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False, server_default='default', index=True),
        sa.Column('integration', sa.String(50), nullable=False, index=True),
        sa.Column('direction', sa.String(20), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'succeeded', 'failed', 'retrying', name='integrationeventstatus'),
            nullable=False,
            server_default='pending',
            index=True,
        ),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.String(36), nullable=True, index=True),
        sa.Column('idempotency_key', sa.String(120), nullable=True, index=True),
        sa.Column('attempts', sa.Integer(), server_default='0'),
        sa.Column('error', sa.String(500), nullable=True),
        sa.Column('payload', sa.JSON(), server_default=sa.text("'{}'")),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), index=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('integration_events')
    op.drop_table('messages')
    op.drop_table('patient_encounters')
    op.drop_table('patient_lab_results')
    op.drop_table('patient_care_plan_items')
    op.drop_table('patient_medications')
    op.drop_table('patient_documents')
    op.drop_table('faxes')
    op.drop_table('provider_availability')
    op.drop_table('appointments')
    op.drop_table('tasks')
    op.drop_table('audit_log')
    op.drop_table('patients')
    op.drop_table('users')
