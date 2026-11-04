"""Rusada students can be added by Telegram ID (no @username needed)

Revision ID: b7c1d2e3f4a5
Revises: a1b2c3d4e5f6
"""
import sqlalchemy as sa
from alembic import op

revision = "b7c1d2e3f4a5"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("members", "username", existing_type=sa.String(64), nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM members WHERE username IS NULL")
    op.alter_column("members", "username", existing_type=sa.String(64), nullable=False)
