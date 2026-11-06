"""XP events and generic game results

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
"""
import sqlalchemy as sa
from alembic import op

revision = "b5c6d7e8f9a0"
down_revision = "a4b5c6d7e8f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "xp_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for c in ("user_id", "source", "created_at"):
        op.create_index(f"ix_xp_events_{c}", "xp_events", [c])
    op.create_table(
        "game_results",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("game", sa.String(20), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for c in ("user_id", "game", "created_at"):
        op.create_index(f"ix_game_results_{c}", "game_results", [c])


def downgrade() -> None:
    op.drop_table("game_results")
    op.drop_table("xp_events")
