"""«Urg‘u»: 60-second round scores

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
"""
import sqlalchemy as sa
from alembic import op

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stress_scores",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("answered", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_stress_scores_user_id", "stress_scores", ["user_id"])
    op.create_index("ix_stress_scores_created_at", "stress_scores", ["created_at"])


def downgrade() -> None:
    op.drop_table("stress_scores")
