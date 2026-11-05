"""«Xatolarim»: spaced repetition of wrong answers

Revision ID: d1e2f3a4b5c6
Revises: c8d9e0f1a2b3
"""
import sqlalchemy as sa
from alembic import op

revision = "d1e2f3a4b5c6"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "review_items",
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("question_id", sa.String(32), sa.ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("box", sa.Integer(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_review_items_due_at", "review_items", ["due_at"])
    op.create_table(
        "review_state",
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("seeded_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("review_state")
    op.drop_table("review_items")
