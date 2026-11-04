"""book PDF for in-app reading

Revision ID: f6d9b3c2e4a8
Revises: e5c8a2b1d3f7
"""
import sqlalchemy as sa
from alembic import op

revision = "f6d9b3c2e4a8"
down_revision = "e5c8a2b1d3f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("pdf", sa.LargeBinary(), nullable=True))
    op.add_column("books", sa.Column("pages", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("books", "pages")
    op.drop_column("books", "pdf")
