"""books shown in the Mini App

Revision ID: e5c8a2b1d3f7
Revises: d4b7e1a9c2f6
"""
import sqlalchemy as sa
from alembic import op

revision = "e5c8a2b1d3f7"
down_revision = "d4b7e1a9c2f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("author", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price", sa.String(64), nullable=False),
        sa.Column("link", sa.String(512), nullable=False),
        sa.Column("cover", sa.LargeBinary(), nullable=True),
        sa.Column("cover_type", sa.String(32), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("books")
