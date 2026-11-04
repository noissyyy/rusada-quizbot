"""group tests can be shown to everyone

Revision ID: d4b7e1a9c2f6
Revises: c3a9f2d1e8b4
"""
import sqlalchemy as sa
from alembic import op

revision = "d4b7e1a9c2f6"
down_revision = "c3a9f2d1e8b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("group_assignments", sa.Column("is_public", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("group_assignments", "is_public")
