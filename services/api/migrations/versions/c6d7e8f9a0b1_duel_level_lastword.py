"""Duel difficulty and «Последнее слово» matches between two people

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c6d7e8f9a0b1"
down_revision = "b5c6d7e8f9a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("duels", sa.Column("difficulty", sa.String(8), nullable=True))
    op.create_table(
        "lastword_matches",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("creator_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opponent_id", sa.String(32), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("words", postgresql.JSONB(), nullable=False),
        sa.Column("turn", sa.String(8), nullable=True),
        sa.Column("winner_id", sa.String(32), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_reason", sa.String(10), nullable=True),
        sa.Column("move_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_lastword_matches_creator_id", "lastword_matches", ["creator_id"])
    op.create_index("ix_lastword_matches_opponent_id", "lastword_matches", ["opponent_id"])


def downgrade() -> None:
    op.drop_table("lastword_matches")
    op.drop_column("duels", "difficulty")
