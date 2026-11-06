"""«So‘z topish»: daily and practice word games

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "word_games",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(10), nullable=False),
        sa.Column("day", sa.Date(), nullable=True),
        sa.Column("answer", sa.String(16), nullable=False),
        sa.Column("guesses", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_word_games_user_id", "word_games", ["user_id"])
    op.create_index("ux_word_games_daily", "word_games", ["user_id", "day"], unique=True,
                    postgresql_where=sa.text("mode = 'daily'"))


def downgrade() -> None:
    op.drop_table("word_games")
