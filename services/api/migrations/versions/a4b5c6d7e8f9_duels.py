"""Duels: same 10 questions for two players

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a4b5c6d7e8f9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "duels",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("creator_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opponent_id", sa.String(32), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("topic_id", sa.String(32), sa.ForeignKey("topics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_duels_creator_id", "duels", ["creator_id"])
    op.create_index("ix_duels_opponent_id", "duels", ["opponent_id"])
    op.create_table(
        "duel_plays",
        sa.Column("duel_id", sa.String(32), sa.ForeignKey("duels.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("correct", sa.Integer(), nullable=False),
        sa.Column("time_ms", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("duel_plays")
    op.drop_table("duels")
